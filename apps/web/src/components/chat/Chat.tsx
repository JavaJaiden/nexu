"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import Composer from "./Composer";
import Timeline from "./Timeline";
import CompareOverlay from "./CompareOverlay";
import type {
  ChatEntry,
  MultiModelRun,
  ExecutionPlan,
  ModelResult,
  ChatMessage,
  SaveTranscriptPayload,
  SolveOutput,
  TranscriptItem,
} from "./types";
import { runModel, runAggregator } from "@/lib/providerAdapters";
import { fileToAttachment, isPdfFile } from "@/lib/attachments";

const DEFAULT_MULTI_MODELS = ["Nexus-Core", "Nexus-Math", "Nexus-Write"];

interface ChatContainerProps {
  chatId: string;
  mode: "fast" | "deep";
  preferredModels: string[];
  aggregatorModel: string;
  attachments: Array<{ name: string; type: string; data: string }>;
  onAttachmentsChange: (attachments: Array<{ name: string; type: string; data: string }>) => void;
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
  onRequestNewChat?: () => void;
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
}: ChatContainerProps) {
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState<ChatEntry[]>(initialTimeline ?? []);
  const [runs, setRuns] = useState<MultiModelRun[]>([]);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);

  const runControllersRef = useRef<Map<string, Map<string, AbortController>>>(new Map());
  const runsRef = useRef<MultiModelRun[]>([]);
  const hasReconstructedRef = useRef(false);

  // Keep runs ref in sync
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const hasRunningRun = runs.some((r) => r.status === "running");
  const isBusy = hasRunningRun;

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

        const tools = toolOverrides?.[msg.id] ?? toolOverridesByIndex?.[messageIndex];
        const solveQuestions = tools?.solveQuestions ?? [];
        const aggregateSolve = solveQuestions.find((s: SolveOutput) => s.kind === "aggregate");
        const baseSolves = solveQuestions.filter((s: SolveOutput) => s.kind !== "aggregate");
        const shouldRenderRun = baseSolves.length > 1 || Boolean(aggregateSolve);

        if (!shouldRenderRun) {
          normalizedTimeline.push(entry);
          return;
        }

        const runId = msg.runId ?? `history-${msg.id}`;
        const modelIds = Array.from(
          new Set(baseSolves.map((s: SolveOutput) => s.model ?? "unknown").filter(Boolean))
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

        const selectedModels = modelIds.length > 0 ? modelIds : [];
        const durationHint =
          aggregateSolve?.durationMs ?? baseSolves[0]?.durationMs ?? 0;
        const run: MultiModelRun = {
          id: runId,
          runId,
          queryText: lastUserQuestion || msg.content || "",
          status: "complete",
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
  }, [initialTimeline, toolOverrides, toolOverridesByIndex]);

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

  const updateRun = useCallback((runId: string, updater: (run: MultiModelRun) => MultiModelRun) => {
    setRuns((prev) => prev.map((r) => (r.id === runId ? updater(r) : r)));
  }, []);

  const startMultiModelRun = useCallback(
    async (question: string, clientMessageId: string) => {
      const runId = crypto.randomUUID();
      const modelIds = effectiveModels;

      const plan: ExecutionPlan = {
        runId,
        question,
        modelIds,
        aggregatorId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
        createdAt: Date.now(),
        mode,
        attachments: [...attachments],
      };

      // Initialize results
      const initialResults: Record<string, ModelResult> = {};
      modelIds.forEach((id) => {
        initialResults[id] = {
          modelId: id,
          status: "running",
        };
      });

      // Create run
      const run: MultiModelRun = {
        id: runId,
        runId,
        queryText: question,
        status: "running",
        selectedModels: modelIds,
        resultsByModel: initialResults,
        executionPlan: plan,
        timings: { startAt: Date.now() },
        counts: { total: modelIds.length, complete: 0, failed: 0, cancelled: 0 },
        showIndividual: false,
        collapsed: true,
      };

      // Add user message and run to timeline
      const userMessage: ChatMessage = {
        id: clientMessageId,
        role: "user",
        content: question,
        optimistic: true,
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
            messages: [{ role: "user", content: question }],
            mode,
            stepsMode: showSteps ? "detailed" : "brief",
            signal: controller.signal,
            attachments,
          });

          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: {
                modelId,
                status: "complete" as const,
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
              },
            };
            const counts = Object.values(nextResults).reduce(
              (acc, r) => {
                if (r.status === "complete") acc.complete++;
                if (r.status === "error") acc.failed++;
                if (r.status === "cancelled") acc.cancelled++;
                return acc;
              },
              { total: modelIds.length, complete: 0, failed: 0, cancelled: 0 }
            );
            return { ...prevRun, resultsByModel: nextResults, counts };
          });
        } catch (error) {
          updateRun(runId, (prevRun) => {
            const nextResults = {
              ...prevRun.resultsByModel,
              [modelId]: {
                modelId,
                status: controller.signal.aborted ? ("cancelled" as const) : ("error" as const),
                errorMessage: (error as Error)?.message ?? "Model failed",
              },
            };
            const counts = Object.values(nextResults).reduce(
              (acc, r) => {
                if (r.status === "complete") acc.complete++;
                if (r.status === "error") acc.failed++;
                if (r.status === "cancelled") acc.cancelled++;
                return acc;
              },
              { total: modelIds.length, complete: 0, failed: 0, cancelled: 0 }
            );
            return { ...prevRun, resultsByModel: nextResults, counts };
          });
        }
      });

      // Wait for all models
      Promise.allSettled(tasks).then(async () => {
        const currentRun = runsRef.current.find((r) => r.id === runId);
        if (!currentRun) return;

        const successful = Object.values(currentRun.resultsByModel).filter(
          (r): r is ModelResult & { text: string } => r.status === "complete" && !!r.text
        );

        if (successful.length > 0) {
          const aggregate = await runAggregator({
            question,
            results: successful.map((r) => ({ modelId: r.modelId, text: r.text })),
            aggregatorModel: plan.aggregatorId,
            attachments,
          });

          updateRun(runId, (prevRun) => ({
            ...prevRun,
            status: "complete",
            aggregated: aggregate,
            timings: { ...prevRun.timings, endAt: Date.now() },
          }));
        } else {
          updateRun(runId, (prevRun) => ({
            ...prevRun,
            status: "error",
            timings: { ...prevRun.timings, endAt: Date.now() },
          }));
        }

        runControllersRef.current.delete(runId);
      });
    },
    [effectiveModels, aggregatorModel, mode, attachments, showSteps, updateRun, onAttachmentsChange]
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
        if (!isPdfFile(file)) continue;
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

  const handleCompareRun = useCallback((runId: string) => {
    setCompareRunId(runId);
    setCompareSelected([]);
  }, []);

  const handleToggleRunIndividual = useCallback(
    (runId: string) => {
      updateRun(runId, (run) => ({ ...run, showIndividual: !run.showIndividual }));
    },
    [updateRun]
  );

  const handleCopyModel = useCallback(
    (runId: string, modelId: string) => {
      const run = runs.find((r) => r.id === runId);
      const text = run?.resultsByModel[modelId]?.text ?? "";
      navigator.clipboard.writeText(text);
    },
    [runs]
  );

  const compareRun = compareRunId ? runs.find((r) => r.id === compareRunId) ?? null : null;

  const runsById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);

  const transcript = useMemo<TranscriptItem[]>(() => {
    if (timeline.length === 0) return [];

    const items: TranscriptItem[] = [];
    timeline.forEach((entry) => {
      if (entry.kind === "snapshot") {
        items.push(entry.snapshot);
        return;
      }

      if (entry.kind === "message") {
        const message = entry.message as ChatMessage;
        if (message.role !== "user" && message.role !== "assistant") return;
        items.push({
          role: message.role,
          content: message.content ?? "",
          snapshotId: message.snapshotId,
        });
        return;
      }

      if (entry.kind === "run") {
        const run = runsById.get(entry.runId);
        if (!run?.aggregated?.text) return;
        const aggregatorId = run.executionPlan.aggregatorId;
        const baseSolves: SolveOutput[] = run.selectedModels
          .map((modelId) => {
            const result = run.resultsByModel[modelId];
            if (!result || result.status !== "complete" || !result.text) return null;
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
          model:
            aggregatorId
              ? modelNameMap.get(aggregatorId) ?? aggregatorId
              : aggregatorModel !== "auto"
                ? modelNameMap.get(aggregatorModel) ?? aggregatorModel
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
  }, [timeline, runsById, aggregatorModel, modelNameMap]);

  const runEntries = useMemo(
    () => timeline.filter((entry) => entry.kind === "run"),
    [timeline]
  );

  const historyModels = useMemo(() => {
    for (let i = runEntries.length - 1; i >= 0; i -= 1) {
      const entry = runEntries[i];
      if (entry.kind !== "run") continue;
      const run = runsById.get(entry.runId);
      if (run?.selectedModels?.length) return Array.from(new Set(run.selectedModels));
    }
    return effectiveModels;
  }, [runEntries, runsById, effectiveModels]);

  const hasRunEntries = runEntries.length > 0;

  const hasUserMessage = useMemo(
    () =>
      transcript.some(
        (item) => "role" in item && item.role === "user" && (item.content ?? "").trim()
      ),
    [transcript]
  );

  useEffect(() => {
    if (!onSaveTranscript || !hasUserMessage) return;
    onSaveTranscript({ transcript, models: historyModels, mode, hasRun: hasRunEntries });
  }, [onSaveTranscript, transcript, historyModels, mode, hasRunEntries, hasUserMessage]);

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
              onPress={onRequestNewChat}
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
        attachments={attachments}
        onRemoveAttachment={(index) =>
          onAttachmentsChange(attachments.filter((_, i) => i !== index))
        }
        onFilesSelected={handleFileSelect}
        placeholder={
          readOnly ? "Viewing history. Click New Chat to ask a question." : undefined
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
