"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { fileToAttachment } from "@/lib/attachments";
import { runAggregator, runModel } from "@/lib/providerAdapters";
import CompareOverlay from "./CompareOverlay";
import Composer from "./Composer";
import Timeline from "./Timeline";
import type {
  BranchSeedPayload,
  ChatEntry,
  ChatMessage,
  ComposerMode,
  ExecutionPlan,
  ModelResult,
  MultiModelRun,
  SaveTranscriptPayload,
  SolveOutput,
  SuggestionTask,
  TaskSuggestionModel,
  ToolOverrides,
  TranscriptItem,
} from "./types";

const DEFAULT_MULTI_MODELS = ["Nexus-Core", "Nexus-Math", "Nexus-Write"];
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 6000;
const MODEL_PHASE_PROGRESS_MAX = 80;
const MIN_AGGREGATION_PHASE_MS = 1200;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1600;
const TASK_SUGGESTION_SEEDS: Record<SuggestionTask, string[]> = {
  code: ["Nexus-Code", "Nexus-Core", "Nexus-Math"],
  creative: ["Nexus-Write", "Nexus-Core", "Nexus-Code"],
  analysis: ["Nexus-Core", "Nexus-Math", "Nexus-Write"],
  general: ["Nexus-Core", "Nexus-Write", "Nexus-Math"],
};

const TASK_SUGGESTION_KEYWORDS: Record<SuggestionTask, RegExp> = {
  code: /(code|coding|debug|program|developer|algorithm|software|function|bug|cs)/i,
  creative:
    /(write|writing|creative|story|essay|tone|literature|draft|humanities)/i,
  analysis:
    /(analysis|reason|research|math|physics|stats|quant|logic|evaluate|problem)/i,
  general: /(general|homework|q&a|mixed|core)/i,
};

async function ensureMinimumAggregationPhase(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_AGGREGATION_PHASE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

interface ChatContainerProps {
  chatId: string;
  mode: ComposerMode;
  preferredModels: string[];
  aggregatorModel: string;
  attachments: Array<{ name: string; type: string; data: string }>;
  onAttachmentsChange: (
    attachments: Array<{ name: string; type: string; data: string }>
  ) => void;
  showSteps: boolean;
  showCitations: boolean;
  collapseAll: boolean;
  modelMetaMap: Map<string, any>;
  modelNameMap: Map<string, string>;
  initialTimeline?: ChatEntry[];
  toolOverrides?: Record<string, any>;
  toolOverridesByIndex?: Array<any>;
  onSaveTranscript?: (payload: SaveTranscriptPayload) => void;
  readOnly?: boolean;
  onRequestNewChat?: (seed?: BranchSeedPayload) => void;
  seededFromBranch?: boolean;
  onModeChange?: (mode: ComposerMode) => void;
  onToggleSteps?: () => void;
  onToggleCitations?: () => void;
  onSetAggregatorModel?: (modelId: string) => void;
  onAddModelsToStack?: (modelIds: string[]) => void;
}

export default function Chat({
  chatId,
  mode,
  preferredModels,
  aggregatorModel,
  attachments,
  onAttachmentsChange,
  showSteps,
  showCitations,
  collapseAll,
  modelMetaMap,
  modelNameMap,
  initialTimeline,
  toolOverrides,
  toolOverridesByIndex,
  onSaveTranscript,
  readOnly = false,
  onRequestNewChat,
  seededFromBranch = false,
  onModeChange,
  onToggleSteps,
  onToggleCitations,
  onSetAggregatorModel,
  onAddModelsToStack,
}: ChatContainerProps) {
  const [input, setInput] = useState("");
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [timeline, setTimeline] = useState<ChatEntry[]>(initialTimeline ?? []);
  const [runs, setRunsState] = useState<MultiModelRun[]>([]);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);

  const runControllersRef = useRef<Map<string, Map<string, AbortController>>>(
    new Map()
  );
  const runsRef = useRef<MultiModelRun[]>([]);
  const hasReconstructedRef = useRef(false);
  const hasInitializedSaveRef = useRef(false);
  const lastSavedSignatureRef = useRef<string | null>(null);

  const setRuns = useCallback(
    (updater: MultiModelRun[] | ((prev: MultiModelRun[]) => MultiModelRun[])) => {
      setRunsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: MultiModelRun[]) => MultiModelRun[])(prev)
            : updater;
        runsRef.current = next;
        return next;
      });
    },
    []
  );

  const hasRunningRun = runs.some((r) => r.status === "running");
  const isBusy = hasRunningRun;

  useEffect(() => {
    if (!seededFromBranch) return;
    hasInitializedSaveRef.current = true;
    lastSavedSignatureRef.current = null;
  }, [seededFromBranch, chatId]);

  // Initialize timeline and reconstruct runs from props (for loading history)
  useEffect(() => {
    if (initialTimeline?.length && !hasReconstructedRef.current) {
      hasReconstructedRef.current = true;
      // Reconstruct runs from transcript history and normalize timeline
      const reconstructedRuns: MultiModelRun[] = [];
      const normalizedTimeline: ChatEntry[] = [];
      let messageIndex = -1;
      let lastUserQuestion = "";

      initialTimeline.forEach((entry) => {
        if (entry.kind !== "message") {
          normalizedTimeline.push(entry);
          return;
        }

        messageIndex += 1;
        const msg = entry.message as ChatMessage;

        if (msg.role === "user") {
          lastUserQuestion = msg.content ?? "";
          normalizedTimeline.push(entry);
          return;
        }

        const tools =
          toolOverrides?.[msg.id] ??
          toolOverridesByIndex?.[messageIndex] ??
          msg.tools;
        const solveQuestions: SolveOutput[] = Array.isArray(
          tools?.solveQuestions
        )
          ? (tools.solveQuestions as SolveOutput[])
          : [];
        const aggregateSolve = solveQuestions.find(
          (s: SolveOutput) => s.kind === "aggregate"
        );
        const baseSolves = solveQuestions.filter(
          (s: SolveOutput) => s.kind !== "aggregate"
        );
        const shouldRenderRun =
          baseSolves.length > 1 || Boolean(aggregateSolve);

        if (!shouldRenderRun) {
          normalizedTimeline.push(entry);
          return;
        }

        const runId = msg.runId ?? `history-${msg.id}`;
        const modelIds: string[] = Array.from(
          new Set(
            baseSolves
              .map((solve: SolveOutput): string | undefined => solve.model)
              .filter(
                (model: string | undefined): model is string =>
                  typeof model === "string" && model.trim().length > 0
              )
          )
        );

        const resultsByModel: Record<string, ModelResult> = {};
        baseSolves.forEach((solve: SolveOutput) => {
          const modelId = solve.model ?? "unknown";
          resultsByModel[modelId] = {
            modelId,
            status: "complete",
            text: solve.final,
            latencyMs: solve.durationMs,
            steps: solve.steps,
            confidence: solve.confidence,
            citations: solve.citations,
            selectionReason: solve.selectionReason,
            gatewayNote: solve.gatewayNote,
            usedModel: solve.model,
          };
        });

        const selectedModels: string[] = modelIds.length > 0 ? modelIds : [];
        const durationHint =
          aggregateSolve?.durationMs ?? baseSolves[0]?.durationMs ?? 0;
        const run: MultiModelRun = {
          id: runId,
          runId,
          queryText: lastUserQuestion || msg.content || "",
          status: "complete",
          progressPhase: "complete",
          progressPercent: 100,
          isRetrying: false,
          selectedModels,
          resultsByModel,
          aggregated: aggregateSolve
            ? {
                text: aggregateSolve.final,
                confidence: aggregateSolve.confidence,
              }
            : undefined,
          executionPlan: {
            runId,
            question: lastUserQuestion || msg.content || "",
            modelIds: selectedModels,
            aggregatorId: aggregateSolve?.model,
            createdAt: Date.now(),
            mode: "fast",
            temperature: DEFAULT_TEMPERATURE,
            maxTokens: DEFAULT_MAX_TOKENS,
            contextMessages: [],
            attachments: [],
          },
          timings: {
            startAt: Date.now() - durationHint,
            endAt: Date.now(),
          },
          counts: {
            total: selectedModels.length,
            complete: selectedModels.length,
            failed: 0,
            cancelled: 0,
          },
          showIndividual: false,
          collapsed: false,
        };

        reconstructedRuns.push(run);
        normalizedTimeline.push({ kind: "run", runId });
      });

      setTimeline(normalizedTimeline);

      if (reconstructedRuns.length > 0) {
        setRuns(reconstructedRuns);
      }
    }
  }, [initialTimeline, toolOverrides, toolOverridesByIndex, setRuns]);

  const effectiveModels = useMemo(() => {
    const unique = Array.from(new Set(preferredModels.filter(Boolean)));
    if (unique.length >= 2) return unique;
    if (unique.length === 1) {
      const filled = [...unique];
      for (const id of DEFAULT_MULTI_MODELS) {
        if (filled.length >= 3) break;
        if (!filled.includes(id)) filled.push(id);
      }
      return filled;
    }
    return DEFAULT_MULTI_MODELS;
  }, [preferredModels]);

  const taskSuggestions = useMemo(() => {
    const models = Array.from(modelMetaMap.values()).filter(Boolean);

    const scoreModelForTask = (model: any, task: SuggestionTask) => {
      const descriptor = [
        model?.id,
        model?.name,
        model?.focus,
        model?.routing,
        ...(Array.isArray(model?.strengths) ? model.strengths : []),
        ...(Array.isArray(model?.useCases) ? model.useCases : []),
        model?.provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let score = 0;
      if (model?.type === "Router") score += 1.5;
      if (model?.accuracy === "High") score += 1;
      if (model?.speed === "Fast") score += 0.75;
      if (model?.costEfficiency === "High") score += 0.25;
      if (TASK_SUGGESTION_KEYWORDS[task].test(descriptor)) score += 2;
      if (task === "general" && /core|general/.test(descriptor)) score += 1.5;
      return score;
    };

    const buildSuggestions = (task: SuggestionTask): TaskSuggestionModel[] => {
      const seeded = TASK_SUGGESTION_SEEDS[task]
        .map((id) => models.find((model: any) => model.id === id))
        .filter(Boolean);
      const seededIds = new Set(seeded.map((model: any) => model.id));

      const ranked = models
        .filter((model: any) => !seededIds.has(model.id))
        .map((model: any) => ({
          id: model.id,
          name: model.name ?? model.id,
          score: scoreModelForTask(model, task),
        }))
        .sort((a, b) => b.score - a.score)
        .map((model) => ({ id: model.id, name: model.name }));

      const merged = [
        ...seeded.map((model: any) => ({
          id: model.id,
          name: model.name ?? model.id,
        })),
        ...ranked,
      ];
      return Array.from(
        new Map(merged.map((model) => [model.id, model])).values()
      ).slice(0, 3);
    };

    return {
      code: buildSuggestions("code"),
      creative: buildSuggestions("creative"),
      analysis: buildSuggestions("analysis"),
      general: buildSuggestions("general"),
    } satisfies Record<SuggestionTask, TaskSuggestionModel[]>;
  }, [modelMetaMap]);

  const updateRun = useCallback(
    (runId: string, updater: (run: MultiModelRun) => MultiModelRun) => {
      setRuns((prev) => prev.map((r) => (r.id === runId ? updater(r) : r)));
    },
    [setRuns]
  );

  const getCounts = useCallback(
    (results: Record<string, ModelResult>, total: number) => {
      return Object.values(results).reduce(
        (acc, item) => {
          if (item.status === "complete") acc.complete += 1;
          if (item.status === "error") acc.failed += 1;
          if (item.status === "cancelled") acc.cancelled += 1;
          return acc;
        },
        { total, complete: 0, failed: 0, cancelled: 0 }
      );
    },
    []
  );

  const getModelPhaseProgress = useCallback(
    (counts: { total: number; complete: number; failed: number; cancelled: number }) => {
      if (counts.total <= 0) return 0;
      const settled = counts.complete + counts.failed + counts.cancelled;
      const ratio = Math.min(1, Math.max(0, settled / counts.total));
      return Math.round(ratio * MODEL_PHASE_PROGRESS_MAX);
    },
    []
  );

  const runsById = useMemo(
    () => new Map(runs.map((run) => [run.id, run])),
    [runs]
  );

  const buildContextMessages = useCallback(() => {
    const messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }> = [];
    timeline.forEach((entry) => {
      if (entry.kind === "message") {
        const message = entry.message as ChatMessage;
        if (
          (message.role === "user" || message.role === "assistant") &&
          (message.content ?? "").trim()
        ) {
          messages.push({ role: message.role, content: message.content ?? "" });
        }
        return;
      }

      if (entry.kind === "run") {
        const run = runsById.get(entry.runId);
        if (run?.aggregated?.text?.trim()) {
          messages.push({ role: "assistant", content: run.aggregated.text });
        }
      }
    });

    const trimmed = messages.filter(
      (message) => message.content.trim().length > 0
    );
    const sliced = trimmed.slice(-MAX_CONTEXT_MESSAGES);

    let totalChars = 0;
    const limited: typeof sliced = [];
    for (let i = sliced.length - 1; i >= 0; i -= 1) {
      const message = sliced[i];
      const length = message.content.length;
      if (totalChars + length > MAX_CONTEXT_CHARS && limited.length > 0) break;
      totalChars += length;
      limited.push(message);
    }
    return limited.reverse();
  }, [timeline, runsById]);

  const startMultiModelRun = useCallback(
    async (question: string, clientMessageId: string) => {
      const runId = crypto.randomUUID();
      const modelIds = effectiveModels;
      const contextMessages = buildContextMessages();
      const resolvedRunMode = mode === "none" ? undefined : mode;
      const executionMode: "fast" | "deep" = mode === "deep" ? "deep" : "fast";
      const runAttachments = [...attachments];

      const plan: ExecutionPlan = {
        runId,
        question,
        modelIds,
        aggregatorId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
        createdAt: Date.now(),
        mode: executionMode,
        temperature,
        maxTokens,
        contextMessages,
        attachments: runAttachments,
      };

      // Initialize results
      const initialResults: Record<string, ModelResult> = {};
      modelIds.forEach((id) => {
        initialResults[id] = {
          modelId: id,
          status: "running",
        };
      });
      const finalResults: Record<string, ModelResult> = { ...initialResults };

      // Create run
      const run: MultiModelRun = {
        id: runId,
        runId,
        queryText: question,
        status: "running",
        progressPhase: "models",
        progressPercent: 0,
        isRetrying: false,
        selectedModels: modelIds,
        resultsByModel: initialResults,
        executionPlan: plan,
        timings: { startAt: Date.now() },
        counts: {
          total: modelIds.length,
          complete: 0,
          failed: 0,
          cancelled: 0,
        },
        showIndividual: false,
        collapsed: true,
      };

      // Add user message and run to timeline
      const userMessage: ChatMessage = {
        id: clientMessageId,
        role: "user",
        content: question,
        optimistic: true,
        attachments: runAttachments,
      };

      setRuns((prev) => [...prev, run]);
      setTimeline((prev) => [
        ...prev,
        { kind: "message", message: userMessage },
        { kind: "run", runId },
      ]);
      setInput("");
      onAttachmentsChange([]);

      // Controllers for cancellation
      const controllerMap = new Map<string, AbortController>();
      runControllersRef.current.set(runId, controllerMap);

      // Run all models in parallel
      const tasks = modelIds.map(async (modelId) => {
        const controller = new AbortController();
        controllerMap.set(modelId, controller);

        try {
          const result = await runModel({
            modelId,
            messages: [...contextMessages, { role: "user", content: question }],
            mode: resolvedRunMode,
            stepsMode: showSteps ? "detailed" : "brief",
            temperature: plan.temperature,
            maxTokens: plan.maxTokens,
            signal: controller.signal,
            attachments: plan.attachments,
          });
          const nextResult: ModelResult = {
            modelId,
            status: "complete",
            latencyMs: result.latencyMs,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            text: result.text,
            steps: result.steps,
            confidence: result.confidence,
            citations: result.citations,
            selectionReason: result.selectionReason,
            gatewayNote: result.gatewayNote,
            usedModel: result.usedModel,
          };
          finalResults[modelId] = nextResult;

          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: nextResult,
            };
            const counts = getCounts(nextResults, modelIds.length);
            return {
              ...prevRun,
              resultsByModel: nextResults,
              counts,
              progressPhase: "models",
              progressPercent: getModelPhaseProgress(counts),
            };
          });
        } catch (error) {
          const nextResult: ModelResult = {
            modelId,
            status: controller.signal.aborted ? "cancelled" : "error",
            errorMessage: (error as Error)?.message ?? "Model failed",
          };
          finalResults[modelId] = nextResult;
          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: nextResult,
            };
            const counts = getCounts(nextResults, modelIds.length);
            return {
              ...prevRun,
              resultsByModel: nextResults,
              counts,
              progressPhase: "models",
              progressPercent: getModelPhaseProgress(counts),
            };
          });
        }
      });

      // Wait for all models
      Promise.allSettled(tasks).then(async () => {
        const currentRun = runsRef.current.find((r) => r.id === runId);
        if (!currentRun) {
          runControllersRef.current.delete(runId);
          return;
        }
        if (currentRun.status === "cancelled") {
          runControllersRef.current.delete(runId);
          return;
        }

        const finalized = modelIds.map((id) => finalResults[id]).filter(Boolean);
        const successful = finalized.filter(
          (result): result is ModelResult & { text: string } =>
            result.status === "complete" && Boolean(result.text)
        );
        const cancelledCount = finalized.filter(
          (result) => result.status === "cancelled"
        ).length;

        if (successful.length > 0) {
          const aggregationStartedAt = Date.now();
          updateRun(runId, (prevRun) => ({
            ...prevRun,
            progressPhase: "aggregating",
            progressPercent: Math.max(prevRun.progressPercent ?? 0, 85),
            aggregationStartedAt,
          }));
          try {
            const aggregate = await runAggregator({
              question,
              results: successful.map((r) => ({
                modelId: r.modelId,
                text: r.text,
              })),
              aggregatorModel: plan.aggregatorId,
              temperature: plan.temperature,
              maxTokens: plan.maxTokens,
              attachments: plan.attachments,
            });
            await ensureMinimumAggregationPhase(aggregationStartedAt);
            const latestRun = runsRef.current.find((r) => r.id === runId);
            if (!latestRun || latestRun.status === "cancelled") {
              runControllersRef.current.delete(runId);
              return;
            }

            updateRun(runId, (prevRun) => ({
              ...prevRun,
              status: "complete",
              progressPhase: "complete",
              progressPercent: 100,
              isRetrying: false,
              aggregationStartedAt: undefined,
              aggregated: aggregate,
              timings: { ...prevRun.timings, endAt: Date.now() },
            }));
          } catch {
            await ensureMinimumAggregationPhase(aggregationStartedAt);
            const latestRun = runsRef.current.find((r) => r.id === runId);
            if (!latestRun || latestRun.status === "cancelled") {
              runControllersRef.current.delete(runId);
              return;
            }
            updateRun(runId, (prevRun) => ({
              ...prevRun,
              status: "error",
              progressPhase: "error",
              progressPercent: 100,
              isRetrying: false,
              aggregationStartedAt: undefined,
              timings: { ...prevRun.timings, endAt: Date.now() },
            }));
          }
        } else {
          updateRun(runId, (prevRun) => ({
            ...prevRun,
            status:
              cancelledCount === modelIds.length && modelIds.length > 0
                ? "cancelled"
                : "error",
            progressPhase:
              cancelledCount === modelIds.length && modelIds.length > 0
                ? "cancelled"
                : "error",
            progressPercent: 100,
            isRetrying: false,
            aggregationStartedAt: undefined,
            timings: { ...prevRun.timings, endAt: Date.now() },
          }));
        }

        runControllersRef.current.delete(runId);
      });
    },
    [
      effectiveModels,
      aggregatorModel,
      mode,
      temperature,
      maxTokens,
      attachments,
      showSteps,
      updateRun,
      getCounts,
      getModelPhaseProgress,
      onAttachmentsChange,
      buildContextMessages,
    ]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isBusy || readOnly) return;

    // Always use multi-model mode
    const clientMessageId = crypto.randomUUID();
    startMultiModelRun(trimmed, clientMessageId);
  }, [input, isBusy, readOnly, startMultiModelRun]);

  const handleStop = useCallback(() => {
    // Cancel any running runs
    runs.forEach((run) => {
      if (run.status === "running") {
        const controllers = runControllersRef.current.get(run.id);
        controllers?.forEach((c) => c.abort());
        runControllersRef.current.delete(run.id);

        updateRun(run.id, (prevRun) => ({
          ...prevRun,
          status: "cancelled",
          progressPhase: "cancelled",
          progressPercent: 100,
          isRetrying: false,
          aggregationStartedAt: undefined,
          timings: { ...prevRun.timings, endAt: Date.now() },
        }));
      }
    });
  }, [runs, updateRun]);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const newAttachments = [];
      for (const file of Array.from(files)) {
        try {
          const attachment = await fileToAttachment(file);
          newAttachments.push(attachment);
        } catch {
          // Ignore failed attachments
        }
      }
      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      }
    },
    [attachments, onAttachmentsChange]
  );

  const handleUseSuggestedAggregator = useCallback(
    (modelId: string) => {
      if (readOnly) return;
      onSetAggregatorModel?.(modelId);
    },
    [readOnly, onSetAggregatorModel]
  );

  const handleAddSuggestedModelsToStack = useCallback(
    (modelIds: string[]) => {
      if (readOnly) return;
      const deduped = Array.from(new Set(modelIds.filter(Boolean)));
      if (deduped.length === 0) return;
      onAddModelsToStack?.(deduped);
    },
    [readOnly, onAddModelsToStack]
  );

  const handleCompareRun = useCallback((runId: string) => {
    setCompareRunId(runId);
    setCompareSelected([]);
  }, []);

  const handleToggleRunIndividual = useCallback(
    (runId: string) => {
      updateRun(runId, (run) => ({
        ...run,
        showIndividual: !run.showIndividual,
      }));
    },
    [updateRun]
  );

  const handleCopyModel = useCallback(
    (runId: string, modelId: string) => {
      const run = runs.find((r) => r.id === runId);
      const text = run?.resultsByModel[modelId]?.text ?? "";
      if (!text) return;
      navigator.clipboard.writeText(text);
    },
    [runs]
  );

  const handleCopyAggregated = useCallback(
    (runId: string) => {
      const run = runs.find((r) => r.id === runId);
      const text = run?.aggregated?.text ?? "";
      if (!text) return;
      navigator.clipboard.writeText(text);
    },
    [runs]
  );

  const retryRunModels = useCallback(
    async (runId: string, modelIdsToRetry: string[]) => {
      if (readOnly) return;
      if (runsRef.current.some((item) => item.status === "running")) return;

      const run = runsRef.current.find((item) => item.id === runId);
      if (!run) return;

      const targetModelIds = Array.from(
        new Set(
          modelIdsToRetry.filter((modelId) =>
            run.selectedModels.includes(modelId)
          )
        )
      );
      if (targetModelIds.length === 0) return;

      const contextMessages = run.executionPlan.contextMessages ?? [];
      const question = run.executionPlan.question || run.queryText;
      const runMode = run.executionPlan.mode ?? mode;
      const runTemperature = run.executionPlan.temperature ?? temperature;
      const runMaxTokens = run.executionPlan.maxTokens ?? maxTokens;
      const runAttachments = run.executionPlan.attachments ?? [];
      const stepsMode = showSteps ? "detailed" : "brief";
      const finalResults: Record<string, ModelResult> = {
        ...run.resultsByModel,
      };
      targetModelIds.forEach((modelId) => {
        finalResults[modelId] = {
          modelId,
          status: "running",
        };
      });

      updateRun(runId, (prevRun) => {
        const nextResults = { ...prevRun.resultsByModel };
        targetModelIds.forEach((modelId) => {
          nextResults[modelId] = {
            modelId,
            status: "running",
          };
        });
        const counts = getCounts(nextResults, prevRun.selectedModels.length);
        return {
          ...prevRun,
          status: "running",
          progressPhase: "models",
          progressPercent: getModelPhaseProgress(counts),
          isRetrying: true,
          aggregationStartedAt: undefined,
          aggregated: undefined,
          resultsByModel: nextResults,
          counts,
          timings: { startAt: Date.now() },
        };
      });

      const controllerMap = new Map<string, AbortController>();
      runControllersRef.current.set(runId, controllerMap);

      const tasks = targetModelIds.map(async (modelId) => {
        const controller = new AbortController();
        controllerMap.set(modelId, controller);

        try {
          const result = await runModel({
            modelId,
            messages: [...contextMessages, { role: "user", content: question }],
            mode: runMode,
            stepsMode,
            temperature: runTemperature,
            maxTokens: runMaxTokens,
            signal: controller.signal,
            attachments: runAttachments,
          });
          const nextResult: ModelResult = {
            modelId,
            status: "complete",
            latencyMs: result.latencyMs,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            text: result.text,
            steps: result.steps,
            confidence: result.confidence,
            citations: result.citations,
            selectionReason: result.selectionReason,
            gatewayNote: result.gatewayNote,
            usedModel: result.usedModel,
          };
          finalResults[modelId] = nextResult;

          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: nextResult,
            };
            const counts = getCounts(nextResults, prevRun.selectedModels.length);
            return {
              ...prevRun,
              resultsByModel: nextResults,
              counts,
              progressPhase: "models",
              progressPercent: getModelPhaseProgress(counts),
              isRetrying: true,
            };
          });
        } catch (error) {
          const nextResult: ModelResult = {
            modelId,
            status: controller.signal.aborted ? "cancelled" : "error",
            errorMessage: (error as Error)?.message ?? "Model failed",
          };
          finalResults[modelId] = nextResult;
          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: nextResult,
            };
            const counts = getCounts(nextResults, prevRun.selectedModels.length);
            return {
              ...prevRun,
              resultsByModel: nextResults,
              counts,
              progressPhase: "models",
              progressPercent: getModelPhaseProgress(counts),
              isRetrying: true,
            };
          });
        }
      });

      await Promise.allSettled(tasks);

      const currentRun = runsRef.current.find((item) => item.id === runId);
      if (!currentRun) {
        runControllersRef.current.delete(runId);
        return;
      }
      if (currentRun.status === "cancelled") {
        runControllersRef.current.delete(runId);
        return;
      }

      const successful = currentRun.selectedModels
        .map((modelId) => finalResults[modelId] ?? currentRun.resultsByModel[modelId])
        .filter((result): result is ModelResult & { text: string } => {
          return Boolean(result && result.status === "complete" && result.text);
        });
      const cancelledCount = currentRun.selectedModels
        .map((modelId) => finalResults[modelId] ?? currentRun.resultsByModel[modelId])
        .filter((result) => result?.status === "cancelled").length;

      if (successful.length > 0) {
        const aggregationStartedAt = Date.now();
        updateRun(runId, (prevRun) => ({
          ...prevRun,
          progressPhase: "aggregating",
          progressPercent: Math.max(prevRun.progressPercent ?? 0, 85),
          aggregationStartedAt,
          isRetrying: true,
        }));
        try {
          const aggregate = await runAggregator({
            question,
            results: successful.map((result) => ({
              modelId: result.modelId,
              text: result.text,
            })),
            aggregatorModel: currentRun.executionPlan.aggregatorId,
            temperature: runTemperature,
            maxTokens: runMaxTokens,
            attachments: runAttachments,
          });
          await ensureMinimumAggregationPhase(aggregationStartedAt);
          const latestRun = runsRef.current.find((item) => item.id === runId);
          if (!latestRun || latestRun.status === "cancelled") {
            runControllersRef.current.delete(runId);
            return;
          }

          updateRun(runId, (prevRun) => ({
            ...prevRun,
            status: "complete",
            progressPhase: "complete",
            progressPercent: 100,
            isRetrying: false,
            aggregationStartedAt: undefined,
            aggregated: aggregate,
            timings: { ...prevRun.timings, endAt: Date.now() },
          }));
        } catch {
          await ensureMinimumAggregationPhase(aggregationStartedAt);
          const latestRun = runsRef.current.find((item) => item.id === runId);
          if (!latestRun || latestRun.status === "cancelled") {
            runControllersRef.current.delete(runId);
            return;
          }
          updateRun(runId, (prevRun) => ({
            ...prevRun,
            status: "error",
            progressPhase: "error",
            progressPercent: 100,
            isRetrying: false,
            aggregationStartedAt: undefined,
            timings: { ...prevRun.timings, endAt: Date.now() },
          }));
        }
      } else {
        updateRun(runId, (prevRun) => ({
          ...prevRun,
          status:
            cancelledCount === currentRun.selectedModels.length &&
            currentRun.selectedModels.length > 0
              ? "cancelled"
              : "error",
          progressPhase:
            cancelledCount === currentRun.selectedModels.length &&
            currentRun.selectedModels.length > 0
              ? "cancelled"
              : "error",
          progressPercent: 100,
          isRetrying: false,
          aggregationStartedAt: undefined,
          timings: { ...prevRun.timings, endAt: Date.now() },
        }));
      }

      runControllersRef.current.delete(runId);
    },
    [
      readOnly,
      mode,
      temperature,
      maxTokens,
      showSteps,
      updateRun,
      getCounts,
      getModelPhaseProgress,
    ]
  );

  const handleRetryModel = useCallback(
    (runId: string, modelId: string) => {
      retryRunModels(runId, [modelId]);
    },
    [retryRunModels]
  );

  const handleRetryAll = useCallback(
    (runId: string) => {
      const run = runsRef.current.find((item) => item.id === runId);
      if (!run) return;
      retryRunModels(runId, run.selectedModels);
    },
    [retryRunModels]
  );

  const branchWithSeed = useCallback(
    (seed: BranchSeedPayload) => {
      const question = seed.question.trim();
      const answer = seed.answer.trim();
      if (!question || !answer) return;

      if (onRequestNewChat) {
        onRequestNewChat({
          question,
          answer,
          answerModel: seed.answerModel,
          tools: seed.tools,
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        tools: seed.tools,
      };
      setRuns([]);
      setTimeline([
        { kind: "message", message: userMessage },
        { kind: "message", message: assistantMessage },
      ]);
      setInput("");
      setCompareRunId(null);
      setCompareSelected([]);
      onAttachmentsChange([]);
      hasInitializedSaveRef.current = true;
      lastSavedSignatureRef.current = null;
    },
    [onRequestNewChat, onAttachmentsChange, setRuns]
  );

  const handleBranchModel = useCallback(
    (runId: string, modelId: string) => {
      const run = runsRef.current.find((item) => item.id === runId);
      if (!run) return;
      const question = run.queryText.trim();
      const result = run.resultsByModel[modelId];
      const answer = result?.text?.trim() ?? "";
      if (!question || !answer) return;
      const resolvedModelId = result?.usedModel ?? modelId;
      const answerModel =
        modelNameMap.get(resolvedModelId) ??
        modelNameMap.get(modelId) ??
        resolvedModelId;
      const tools: ToolOverrides = {
        solveQuestions: [
          {
            steps: result?.steps ?? [],
            final: answer,
            model: answerModel,
            confidence: result?.confidence,
            citations: result?.citations ?? [],
            durationMs: result?.latencyMs,
            selectionReason: result?.selectionReason,
            gatewayNote: result?.gatewayNote,
            kind: "solve",
          },
        ],
      };
      branchWithSeed({
        question,
        answer,
        answerModel,
        tools,
      });
    },
    [branchWithSeed, modelNameMap]
  );

  const handleBranchAggregated = useCallback(
    (runId: string) => {
      const run = runsRef.current.find((item) => item.id === runId);
      if (!run) return;
      const question = run.queryText.trim();
      const answer = run.aggregated?.text?.trim() ?? "";
      if (!question || !answer) return;
      const aggregatorId = run.executionPlan.aggregatorId;
      const aggregateModelLabel = aggregatorId
        ? (modelNameMap.get(aggregatorId) ?? aggregatorId)
        : "Aggregator";
      const baseSolves = run.selectedModels
        .map((modelId): SolveOutput | null => {
          const result = run.resultsByModel[modelId];
          const text = result?.text?.trim();
          if (!result || result.status !== "complete" || !text) return null;
          const resolvedModelId = result.usedModel ?? modelId;
          const modelLabel =
            modelNameMap.get(resolvedModelId) ??
            modelNameMap.get(modelId) ??
            resolvedModelId;
          return {
            steps: result.steps ?? [],
            final: text,
            model: modelLabel,
            confidence: result.confidence,
            citations: result.citations ?? [],
            durationMs: result.latencyMs,
            selectionReason: result.selectionReason,
            gatewayNote: result.gatewayNote,
            kind: "solve",
          };
        })
        .filter((solve): solve is SolveOutput => Boolean(solve));
      const aggregateSolve: SolveOutput = {
        steps: [],
        final: answer,
        model: aggregateModelLabel,
        confidence: run.aggregated?.confidence,
        citations: [],
        durationMs:
          typeof run.timings.endAt === "number"
            ? run.timings.endAt - run.timings.startAt
            : undefined,
        kind: "aggregate",
      };
      branchWithSeed({
        question,
        answer,
        answerModel: aggregateModelLabel,
        tools: { solveQuestions: [...baseSolves, aggregateSolve] },
      });
    },
    [branchWithSeed, modelNameMap]
  );

  const compareRun = compareRunId
    ? (runs.find((r) => r.id === compareRunId) ?? null)
    : null;

  const transcript = useMemo<TranscriptItem[]>(() => {
    if (timeline.length === 0) return [];

    const items: TranscriptItem[] = [];
    let messageIndex = -1;
    timeline.forEach((entry) => {
      if (entry.kind === "snapshot") {
        items.push(entry.snapshot);
        return;
      }

      if (entry.kind === "message") {
        messageIndex += 1;
        const message = entry.message as ChatMessage;
        if (message.role !== "user" && message.role !== "assistant") return;
        const assistantTools =
          message.role === "assistant"
            ? message.tools ??
              toolOverrides?.[message.id] ??
              toolOverridesByIndex?.[messageIndex]
            : undefined;
        items.push({
          role: message.role,
          content: message.content ?? "",
          snapshotId: message.snapshotId,
          tools: assistantTools,
        });
        return;
      }

      if (entry.kind === "run") {
        const run = runsById.get(entry.runId);
        if (!run || run.status !== "complete" || !run.aggregated?.text) return;
        const aggregatorId = run.executionPlan.aggregatorId;
        const baseSolves: SolveOutput[] = run.selectedModels
          .map((modelId) => {
            const result = run.resultsByModel[modelId];
            if (!result || result.status !== "complete" || !result.text)
              return null;
            return {
              steps: result.steps ?? [],
              final: result.text,
              model: result.usedModel ?? modelId,
              confidence: result.confidence,
              citations: result.citations ?? [],
              durationMs: result.latencyMs,
              selectionReason: result.selectionReason,
              gatewayNote: result.gatewayNote,
              kind: "solve",
            } as SolveOutput;
          })
          .filter((solve): solve is SolveOutput => Boolean(solve));
        const aggregateSolve: SolveOutput = {
          steps: [],
          final: run.aggregated.text,
          model: aggregatorId
            ? (modelNameMap.get(aggregatorId) ?? aggregatorId)
            : aggregatorModel !== "auto"
              ? (modelNameMap.get(aggregatorModel) ?? aggregatorModel)
              : undefined,
          confidence: run.aggregated.confidence,
          citations: [],
          durationMs:
            typeof run.timings.endAt === "number"
              ? run.timings.endAt - run.timings.startAt
              : undefined,
          kind: "aggregate",
        };
        items.push({
          role: "assistant",
          content: run.aggregated.text,
          tools: { solveQuestions: [...baseSolves, aggregateSolve] },
        });
      }
    });

    return items;
  }, [
    timeline,
    runsById,
    aggregatorModel,
    modelNameMap,
    toolOverrides,
    toolOverridesByIndex,
  ]);

  const runEntries = useMemo(
    () => timeline.filter((entry) => entry.kind === "run"),
    [timeline]
  );

  const historyModels = useMemo(() => {
    for (let i = runEntries.length - 1; i >= 0; i -= 1) {
      const entry = runEntries[i];
      if (entry.kind !== "run") continue;
      const run = runsById.get(entry.runId);
      if (run?.selectedModels?.length)
        return Array.from(new Set(run.selectedModels));
    }

    for (let i = transcript.length - 1; i >= 0; i -= 1) {
      const item = transcript[i];
      if (!("role" in item) || item.role !== "assistant") continue;
      const solveModels = (item.tools?.solveQuestions ?? [])
        .map((solve) => solve.model?.trim())
        .filter(
          (model): model is string =>
            typeof model === "string" && model.length > 0
        );
      if (solveModels.length > 0) return Array.from(new Set(solveModels));
    }

    return effectiveModels;
  }, [runEntries, runsById, transcript, effectiveModels]);

  const hasRunEntries = runEntries.length > 0;

  const hasUserMessage = useMemo(
    () =>
      transcript.some(
        (item) =>
          "role" in item && item.role === "user" && (item.content ?? "").trim()
      ),
    [transcript]
  );

  useEffect(() => {
    if (!onSaveTranscript || !hasUserMessage) return;
    const signature = JSON.stringify(transcript);
    const persistedMode: "fast" | "deep" = mode === "deep" ? "deep" : "fast";
    if (!hasInitializedSaveRef.current) {
      hasInitializedSaveRef.current = true;
      lastSavedSignatureRef.current = signature;
      return;
    }
    if (signature === lastSavedSignatureRef.current) return;
    lastSavedSignatureRef.current = signature;
    onSaveTranscript({
      transcript,
      models: historyModels,
      mode: persistedMode,
      hasRun: hasRunEntries,
    });
  }, [
    onSaveTranscript,
    transcript,
    historyModels,
    mode,
    hasRunEntries,
    hasUserMessage,
  ]);

  return (
    <YStack flex={1} gap="$lg">
      {/* Timeline */}
      <YStack flex={1} gap="$lg">
        <Timeline
          entries={timeline}
          runs={runs}
          toolOverrides={toolOverrides}
          toolOverridesByIndex={toolOverridesByIndex}
          showSteps={showSteps}
          showCitations={showCitations}
          collapseAll={collapseAll}
          modelMetaMap={modelMetaMap}
          modelNameMap={modelNameMap}
          onCompareRun={handleCompareRun}
          onToggleRunIndividual={handleToggleRunIndividual}
          onCopyModel={handleCopyModel}
          onCopyAggregated={handleCopyAggregated}
          onRetryModel={handleRetryModel}
          onRetryAll={handleRetryAll}
          onBranchModel={handleBranchModel}
          onBranchAggregated={handleBranchAggregated}
        />
      </YStack>

      {readOnly && (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          padding="$md"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$backgroundSecondary"
        >
          <Text fontSize={13} color="$textMuted">
            Viewing history. Start a new chat to ask another question.
          </Text>
          {onRequestNewChat && (
            <Button
              size="$2"
              backgroundColor="$color"
              color="$background"
              borderRadius="$md"
              onPress={() => onRequestNewChat()}
            >
              New Chat
            </Button>
          )}
        </XStack>
      )}

      {/* Composer */}
      <Composer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isBusy={isBusy}
        isReadOnly={readOnly}
        mode={mode}
        onModeChange={(nextMode) => onModeChange?.(nextMode)}
        showSteps={showSteps}
        onToggleSteps={() => onToggleSteps?.()}
        showCitations={showCitations}
        onToggleCitations={() => onToggleCitations?.()}
        attachments={attachments}
        onRemoveAttachment={(index) =>
          onAttachmentsChange(attachments.filter((_, i) => i !== index))
        }
        onFilesSelected={handleFileSelect}
        taskSuggestions={taskSuggestions}
        onUseSuggestedAggregator={handleUseSuggestedAggregator}
        onAddSuggestedModelsToStack={handleAddSuggestedModelsToStack}
        temperature={temperature}
        maxTokens={maxTokens}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
        placeholder={
          readOnly
            ? "Viewing history. Click New Chat to ask a question."
            : undefined
        }
      />

      {/* Compare Overlay */}
      <CompareOverlay
        open={!!compareRun}
        run={compareRun}
        modelNameMap={modelNameMap}
        onClose={() => {
          setCompareRunId(null);
          setCompareSelected([]);
        }}
        initialSelected={compareSelected}
      />
    </YStack>
  );
}
