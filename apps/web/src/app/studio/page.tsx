"use client";

import Header from "@/components/Header";
import {
  loadHistory,
  upsertHistoryEntry,
  type HistoryEntry,
  type ModelSelectionSnapshot,
  type RouteOutput,
  type SolveOutput,
  type SubjectOutput,
  type TranscriptItem,
  type TranscriptMessage,
} from "@/lib/historyStore";
import { loadLabPresets, type LabPreset } from "@/lib/labStore";
import { getModelHubCards, getModelNameMap, type ModelCard } from "@/lib/modelCatalog";
import { useChat } from "ai/react";
import type { Message, ToolInvocation } from "ai";
import { useMemo, useState, useEffect, useId, useRef, useCallback } from "react";
import { Button, H1, Paragraph, Text, XStack, YStack, Input } from "tamagui";
import { useRouter, useSearchParams } from "next/navigation";
import MultiModelRunPanel from "@/components/studio/MultiModelRunPanel";
import AggregatedResponseCard from "@/components/studio/AggregatedResponseCard";
import IndividualResponsesGrid from "@/components/studio/IndividualResponsesGrid";
import CompareOverlay from "@/components/studio/CompareOverlay";
import AgentPicker from "@/components/AgentPicker";
import AgentStackPicker from "@/components/AgentStackPicker";
import ModelSelectionSnapshotBlock from "@/components/studio/ModelSelectionSnapshotBlock";
import CurrentSelectionPanel from "@/components/studio/CurrentSelectionPanel";
import CompactComposer from "@/components/studio/CompactComposer";
import type { ExecutionPlan, MultiModelRun, ModelResult } from "@/components/studio/types";
import { runAggregator, runModel } from "@/lib/providerAdapters";
import { useThemeSetting } from "@/lib/themeContext";
import type { PdfAttachment } from "@/lib/externalContext";
import { fileToAttachment, isPdfFile } from "@/lib/attachments";

const DEFAULT_MULTI_MODELS = ["Nexus-Core", "Nexus-Math", "Nexus-Write"] as const;

function createSnapshotId() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now());
}


function extractAssistantText(message: Message) {
  const parts = (message as Message & { parts?: any[] }).parts ?? [];
  const textParts = parts.filter((part) => part.type === "text");
  if (textParts.length === 0) return message.content;
  return textParts.map((part) => part.text).join("\n");
}

function formatLatency(ms?: number) {
  if (!Number.isFinite(ms)) return "unknown";
  if ((ms as number) < 1000) return `${Math.max(0, Math.round(ms as number))} ms`;
  return `${((ms as number) / 1000).toFixed(2)} s`;
}

function formatProjectDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function getProjectQuestion(project: HistoryEntry) {
  const transcriptQuestion =
    project.transcript?.find(
      (message): message is TranscriptMessage =>
        typeof message === "object" && "role" in message && message.role === "user"
    )?.content ?? "";
  return transcriptQuestion || project.question;
}

function getSolveCitations(solve: SolveOutput) {
  const modelLabel = solve.model ?? "Model";
  return [`Model: ${modelLabel}`, `Time: ${formatLatency(solve.durationMs)}`];
}

function getModelAttribution(solves: SolveOutput[], routes: RouteOutput[]) {
  const solveModels = solves
    .filter((solve) => solve.kind !== "aggregate")
    .map((solve) => solve.model)
    .filter(Boolean) as string[];
  const routeModels = routes.map((route) => route.model).filter(Boolean) as string[];
  const models = solveModels.length > 0 ? solveModels : routeModels;
  if (models.length === 0) return null;

  const counts = new Map<string, number>();
  models.forEach((model) => {
    counts.set(model, (counts.get(model) ?? 0) + 1);
  });

  const entries = Array.from(counts.entries()).map(([model, count]) => ({
    model,
    count,
  }));

  if (entries.length === 1) {
    return `Model used: ${entries[0].model} (${entries[0].count}×)`;
  }

  return `Models used: ${entries
    .map((entry) => `${entry.model} (${entry.count}×)`)
    .join(", ")}`;
}

function collectToolOutputs(
  message: Message,
  toolOverride?: TranscriptMessage["tools"]
): {
  subject?: SubjectOutput;
  routeModels: RouteOutput[];
  solveQuestions: SolveOutput[];
} {
  const routeModels = [...(toolOverride?.routeModels ?? [])];
  const solveQuestions = [...(toolOverride?.solveQuestions ?? [])];
  let subject = toolOverride?.detectSubject;

  const parts = (message as Message & { parts?: any[] }).parts ?? [];
  parts.forEach((part) => {
    const invocation = getToolInvocationFromPart(part);
    if (!invocation || !isToolResult(invocation)) return;
    const output =
      (invocation as ToolInvocationLike).result ?? (invocation as ToolInvocationLike).output;

    if (invocation.toolName === "detectSubject") {
      subject = output as SubjectOutput;
    }
    if (invocation.toolName === "routeModel") {
      routeModels.push(output as RouteOutput);
    }
    if (invocation.toolName === "solveQuestion") {
      if (Array.isArray(output)) {
        solveQuestions.push(...(output as SolveOutput[]));
      } else if (output && typeof output === "object" && "solves" in (output as Record<string, unknown>)) {
        const payload = output as { solves?: SolveOutput[]; aggregate?: SolveOutput };
        if (payload.solves) solveQuestions.push(...payload.solves);
        if (payload.aggregate) solveQuestions.push(payload.aggregate);
      } else {
        solveQuestions.push(output as SolveOutput);
      }
    }
  });

  return { subject, routeModels, solveQuestions };
}

type ToolInvocationLike = ToolInvocation & { output?: unknown };

function getToolInvocationFromPart(part: any): ToolInvocationLike | null {
  if (part?.type === "tool-invocation" && part.toolInvocation) {
    return part.toolInvocation as ToolInvocationLike;
  }

  if (typeof part?.type === "string" && part.type.startsWith("tool-")) {
    return {
      toolName: part.type.replace("tool-", ""),
      state: part.state ?? "output-available",
      toolCallId: part.toolCallId ?? part.toolInvocation?.toolCallId ?? part.id ?? "",
      args: part.args ?? part.toolInvocation?.args ?? {},
      result: part.output,
      output: part.output,
    } as ToolInvocationLike;
  }

  return null;
}

type ChatEntry =
  | { kind: "message"; message: Message }
  | { kind: "run"; runId: string }
  | { kind: "snapshot"; snapshot: ModelSelectionSnapshot };

function isToolResult(invocation: ToolInvocationLike) {
  return invocation.state === "result" || invocation.state === "output-available";
}

function AssistantMessage({
  message,
  toolOverride,
  showSteps,
  showCitations,
  globalCollapsed,
}: {
  message: Message;
  toolOverride?: TranscriptMessage["tools"];
  showSteps: boolean;
  showCitations: boolean;
  globalCollapsed: boolean;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  useEffect(() => {
    if (globalCollapsed) setLocalExpanded(false);
  }, [globalCollapsed]);
  const toolData = useMemo(
    () => collectToolOutputs(message, toolOverride),
    [message, toolOverride]
  );
  const aggregateSolve = toolData.solveQuestions.find((solve) => solve.kind === "aggregate");
  const baseSolves = toolData.solveQuestions.filter((solve) => solve.kind !== "aggregate");
  const latestSolve = baseSolves[baseSolves.length - 1];
  const finalSolve = aggregateSolve ?? latestSolve;
  const isAggregated = Boolean(aggregateSolve);
  const finalAnswer = finalSolve?.final ?? extractAssistantText(message) ?? "";
  const modelAttribution =
    (finalSolve?.model
      ? `${isAggregated ? "Aggregator Model used" : "Model used"}: ${finalSolve.model} (1×)`
      : null) ??
    getModelAttribution(toolData.solveQuestions, toolData.routeModels);
  const latestRoute = toolData.routeModels[toolData.routeModels.length - 1];
  const detailLines = useMemo(() => {
    const details: string[] = [];
    if (toolData.subject?.subject) {
      const confidenceNote =
        typeof toolData.subject.confidence === "number"
          ? ` (${(toolData.subject.confidence * 100).toFixed(0)}%)`
          : "";
      details.push(`Detected subject: ${toolData.subject.subject}${confidenceNote}`);
    }
    if (baseSolves.length > 1) {
      const stackedModels = baseSolves
        .map((solve) => solve.model)
        .filter(Boolean)
        .join(", ");
      if (stackedModels) {
        details.push(`Stacked models: ${stackedModels}`);
      }
    }
    if (aggregateSolve?.selectionReason) {
      details.push(`Aggregator: ${aggregateSolve.selectionReason}`);
    }
    if (latestRoute?.rationale) {
      details.push(`Why selected: ${latestRoute.rationale}`);
    }
    if (latestRoute?.mode) {
      details.push(`Mode: ${latestRoute.mode}`);
    }
    if (typeof latestRoute?.confidence === "number") {
      details.push(`Routing confidence: ${(latestRoute.confidence * 100).toFixed(0)}%`);
    }
    return details;
  }, [aggregateSolve?.selectionReason, baseSolves, latestRoute, toolData.subject]);
  const confidenceLabel =
    typeof finalSolve?.confidence === "number"
      ? `Confidence: ${(finalSolve.confidence * 100).toFixed(0)}%`
      : null;
  const showDetails = !globalCollapsed || localExpanded;

  return (
    <YStack
      gap="$sm"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$sm"
      backgroundColor="$background"
    >
      {Boolean(finalAnswer) && (
        <FinalAnswerCard
          answer={finalAnswer}
          attribution={modelAttribution}
          details={detailLines}
          confidence={confidenceLabel}
          showDetails={showDetails}
          onToggleDetails={() => setLocalExpanded((prev) => !prev)}
          showCitations={showCitations}
          latencyMs={finalSolve?.durationMs}
        />
      )}
      {showDetails && (
        <XStack gap="$sm" flexWrap="wrap">
          {baseSolves.map((solve, index) => (
            <SolveCard
              key={`solve-${solve.model ?? "model"}-${index}`}
              solve={solve}
              showSteps={showSteps}
              showCitations={showCitations}
            />
          ))}
        </XStack>
      )}
    </YStack>
  );
}

function FinalAnswerCard({
  answer,
  attribution,
  details,
  confidence,
  showDetails,
  showCitations,
  latencyMs,
  onToggleDetails,
}: {
  answer: string;
  attribution?: string | null;
  details?: string[];
  confidence?: string | null;
  showDetails?: boolean;
  showCitations?: boolean;
  latencyMs?: number;
  onToggleDetails?: () => void;
}) {
  const { theme } = useThemeSetting();
  const isDark = theme === "dark";
  const finalBg = isDark ? "#0f1f16" : "#e8f7ef";
  const finalText = isDark ? "$color" : "#0a3d2a";
  const compact = !showDetails;
  return (
    <YStack gap="$xs">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={12} color="$textMuted">
          Final answer
        </Text>
        {onToggleDetails && (
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            onPress={onToggleDetails}
          >
            {showDetails ? "Collapse" : "Expand"}
          </Button>
        )}
      </XStack>
      <YStack
        padding="$sm"
        borderWidth={1}
        borderColor="$success"
        borderRadius="$sm"
        backgroundColor={finalBg}
        marginTop="$xs"
        minHeight={80}
        maxHeight={compact ? 80 : undefined}
        overflow={compact ? "hidden" : "visible"}
      >
        <Paragraph
          fontSize={16}
          fontWeight="600"
          color={finalText}
          numberOfLines={compact ? 3 : undefined}
        >
          {answer}
        </Paragraph>
      </YStack>
      {attribution && (
        <Text fontSize={12} color="$textMuted" marginTop="$xs">
          {attribution}
        </Text>
      )}
      {showDetails &&
        details?.map((line) => (
          <Text key={line} fontSize={12} color="$textMuted">
            {line}
          </Text>
        ))}
      {showDetails && showCitations && typeof latencyMs === "number" && (
        <Text fontSize={12} color="$textMuted">
          Latency: {formatLatency(latencyMs)}
        </Text>
      )}
      {confidence && (
        <Text fontSize={12} color="$textMuted">
          {confidence}
        </Text>
      )}
    </YStack>
  );
}

function SolveCard({
  solve,
  showSteps = true,
  showCitations = false,
}: {
  solve: SolveOutput;
  showSteps?: boolean;
  showCitations?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(true);
  const citations = showCitations ? getSolveCitations(solve) : [];
  return (
    <YStack flex={1} minWidth={260} borderWidth={1} borderColor="$border" borderRadius="$sm" padding="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={12} color="$textMuted">
          Answer ({solve.model ?? "Model"})
        </Text>
        <Button
          size="$2"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          color="$color"
          onPress={() => setShowDetails((prev) => !prev)}
        >
          {showDetails ? "Hide reasoning" : "Show reasoning"}
        </Button>
      </XStack>
      {showDetails && (
        <YStack gap="$xs" marginTop="$xs">
          {showCitations && (
            <>
              <Text fontSize={12} color="$textMuted">
                Model: {solve.model ?? "Model"}
              </Text>
              <Text fontSize={12} color="$textMuted">
                Latency: {formatLatency(solve.durationMs)}
              </Text>
            </>
          )}
          {solve.selectionReason && (
            <Text fontSize={12} color="$textMuted">
              Why selected: {solve.selectionReason}
            </Text>
          )}
          {solve.gatewayNote && (
            <Text fontSize={12} color="$textMuted">
              {solve.gatewayNote}
            </Text>
          )}
          {showSteps &&
            solve.steps.map((step, index) => (
              <XStack key={`${solve.model ?? "model"}-step-${index}`} gap="$sm" alignItems="flex-start">
                <Text fontSize={12} color="$textMuted">
                  {index + 1}.
                </Text>
                <Paragraph fontSize={14} color="$color">
                  {step}
                </Paragraph>
              </XStack>
            ))}
        </YStack>
      )}
      <YStack
        marginTop="$sm"
        padding="$sm"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$sm"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={12} color="$textMuted">
          Final Answer
        </Text>
        <Text fontSize={16} fontWeight="600" color="$color">
          {solve.final}
        </Text>
      </YStack>
      {showDetails && typeof solve.confidence === "number" && (
        <Text fontSize={12} color="$textMuted" marginTop="$xs">
          Confidence: {(solve.confidence * 100).toFixed(0)}%
        </Text>
      )}
      {showDetails && showCitations && citations.length > 0 && (
        <YStack marginTop="$xs" gap="$xs">
          <Text fontSize={12} color="$textMuted">
            Citations
          </Text>
          {citations.map((citation, index) => (
            <Text key={`${solve.model ?? "model"}-citation-${index}`} fontSize={12} color="$textMuted">
              {citation}
            </Text>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function StudioChat({
  chatId,
  mode,
  onReset,
  justSaved,
  onClearSavedNotice,
  onProjectSaved,
  initialMessages,
  initialTimeline,
  toolOverrides,
  toolOverridesByIndex,
  activeProjectId,
  showSteps,
  showCitations,
  collapseAll,
  multiMode,
  preferredModels,
  onPreferredModelsChange,
  onToggleCitations,
  onToggleSteps,
  onModeChange,
  aggregatorModel,
  onAggregatorModelChange,
  modelCatalog,
  labPresets,
  modelNameMap,
  modelMetaMap,
  newProjectRequest,
}: {
  chatId: string;
  mode: "fast" | "deep";
  onReset: (saved: boolean) => void;
  justSaved: boolean;
  onClearSavedNotice: () => void;
  onProjectSaved: (entries: HistoryEntry[]) => void;
  initialMessages?: Message[];
  initialTimeline?: ChatEntry[];
  toolOverrides?: Record<string, TranscriptMessage["tools"]>;
  toolOverridesByIndex?: Array<TranscriptMessage["tools"] | undefined>;
  activeProjectId?: string | null;
  showSteps: boolean;
  showCitations: boolean;
  collapseAll: boolean;
  multiMode: boolean;
  preferredModels: string[];
  onPreferredModelsChange: (models: string[]) => void;
  onToggleCitations: () => void;
  onToggleSteps: () => void;
  onModeChange: (mode: "fast" | "deep") => void;
  aggregatorModel: string;
  onAggregatorModelChange: (model: string) => void;
  modelCatalog: ModelCard[];
  labPresets: LabPreset[];
  modelNameMap: Map<string, string>;
  modelMetaMap: Map<string, ModelCard>;
  newProjectRequest: number;
}) {
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<PdfAttachment[]>([]);
  const [runs, setRuns] = useState<MultiModelRun[]>([]);
  const [timeline, setTimeline] = useState<ChatEntry[]>(initialTimeline ?? []);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);
  const runControllersRef = useRef<Map<string, Map<string, AbortController>>>(new Map());
  const allowHistorySaveRef = useRef(false);
  const sendGuardRef = useRef(false);
  const lastRunRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const questionRevisionRef = useRef(0);
  const lastSubmittedRevisionRef = useRef(-1);
  const lastSubmittedQuestionRef = useRef("");
  const isSendingRef = useRef(false);
  const pendingClientMessageIdRef = useRef<string | null>(null);
  const duplicateSendWarnIdRef = useRef<string | null>(null);
  const currentSendIdRef = useRef<string | null>(null);
  const pendingRunKeysRef = useRef<Set<string>>(new Set());
  const runKeyByIdRef = useRef<Map<string, string>>(new Map());
  const lastUserSnapshotRef = useRef<string | null>(null);
  const pendingUserSnapshotQueueRef = useRef<string[]>([]);
  const latestSnapshotIdRef = useRef<string | null>(null);
  const inFlightSnapshotIdRef = useRef<string | null>(null);
  const effectiveSelectedModels = useMemo(() => {
    const uniquePreferred = Array.from(
      new Set(preferredModels.filter((entry): entry is string => Boolean(entry)))
    );
    if (uniquePreferred.length >= 2) return uniquePreferred;
    const unique = new Set<string>();
    if (uniquePreferred.length === 1) unique.add(uniquePreferred[0]);
    for (const id of DEFAULT_MULTI_MODELS) {
      if (unique.size >= 3) break;
      unique.add(id);
    }
    const result = Array.from(unique);
    return result.length >= 2 ? result : Array.from(DEFAULT_MULTI_MODELS);
  }, [preferredModels]);
  const isDefaultStack = preferredModels.length < 2;
  const stackCount = effectiveSelectedModels.length;
  const selectionMode: ModelSelectionSnapshot["selectionMode"] =
    preferredModels.length >= 2 ? "multi" : preferredModels.length === 1 ? "single" : "auto";
  const selectionModelIds = selectionMode === "auto" ? [] : preferredModels;
  const { messages, append, status, stop } = useChat({
    api: "/api/studio",
    body: {
      mode,
      preferredModels: multiMode && preferredModels.length > 0 ? preferredModels : undefined,
      aggregatorModel: aggregatorModel === "auto" ? undefined : aggregatorModel,
      attachments,
    },
    id: chatId,
    initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasMessages = timeline.length > 0;

  const buildRunKeyFromPlan = useCallback((plan: ExecutionPlan) => {
    const modelKey = Array.from(new Set(plan.modelIds)).sort().join("|");
    const attachmentKey = plan.attachments
      .map((item) => `${item.name}:${item.data.length}`)
      .sort()
      .join("|");
    const aggregatorKey = plan.aggregatorId ?? "auto";
    return `${plan.question}|${modelKey}|${aggregatorKey}|${plan.mode}|${attachmentKey}`;
  }, []);

  const buildSelectionSnapshot = useCallback((): ModelSelectionSnapshot => {
    const label =
      selectionMode === "auto"
        ? "Auto (Nexus routing)"
        : selectionMode === "single"
          ? "Single model selected"
          : "Multi-model stack selected";
    return {
      id: createSnapshotId(),
      type: "model_selection_snapshot",
      createdAt: new Date().toISOString(),
      status: "draft",
      selectionMode,
      selectedModelIds: selectionModelIds,
      aggregatorModelId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
      label,
      pinned: true,
      appliesTo: "next_message",
    };
  }, [aggregatorModel, selectionMode, selectionModelIds]);

  const selectionSignature = useMemo(() => {
    const modelKey = [...selectionModelIds].sort().join("|");
    const aggregatorKey = aggregatorModel !== "auto" ? aggregatorModel : "auto";
    return `${selectionMode}|${modelKey}|${aggregatorKey}`;
  }, [selectionMode, selectionModelIds, aggregatorModel]);

  const getSnapshotSignature = useCallback((snapshot: ModelSelectionSnapshot) => {
    const modelKey = [...snapshot.selectedModelIds].sort().join("|");
    const aggregatorKey = snapshot.aggregatorModelId ?? "auto";
    return `${snapshot.selectionMode}|${modelKey}|${aggregatorKey}`;
  }, []);

  const snapshots = useMemo(
    () => timeline.filter((entry): entry is { kind: "snapshot"; snapshot: ModelSelectionSnapshot } => entry.kind === "snapshot"),
    [timeline]
  );
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1].snapshot : null;
  const draftSnapshot = useMemo(() => {
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      if (snapshots[i].snapshot.status === "draft") return snapshots[i].snapshot;
    }
    return null;
  }, [snapshots]);
  const lastFinalSnapshot = useMemo(() => {
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      if (snapshots[i].snapshot.status === "final") return snapshots[i].snapshot;
    }
    return null;
  }, [snapshots]);

  useEffect(() => {
    latestSnapshotIdRef.current = latestSnapshot?.id ?? null;
  }, [latestSnapshot]);

  const hasAnswer = useMemo(() => {
    const hasAssistantMessage = timeline.some(
      (entry) => entry.kind === "message" && entry.message.role === "assistant"
    );
    const hasCompletedRun = runs.some((run) => run.status === "complete");
    return hasAssistantMessage || hasCompletedRun;
  }, [timeline, runs]);

  const updateSnapshotInTimeline = useCallback(
    (snapshotId: string, updater: (snapshot: ModelSelectionSnapshot) => ModelSelectionSnapshot) => {
      setTimeline((prev) =>
        prev.map((entry) =>
          entry.kind === "snapshot" && entry.snapshot.id === snapshotId
            ? { kind: "snapshot", snapshot: updater(entry.snapshot) }
            : entry
        )
      );
    },
    []
  );

  const removeSnapshotFromTimeline = useCallback((snapshotId: string) => {
    setTimeline((prev) =>
      prev.filter(
        (entry) => !(entry.kind === "snapshot" && entry.snapshot.id === snapshotId)
      )
    );
  }, []);

  const insertSnapshotAfterLastAnswer = useCallback(
    (snapshot: ModelSelectionSnapshot) => {
      setTimeline((prev) => {
        let insertIndex = -1;
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const entry = prev[i];
          if (entry.kind === "message" && entry.message.role === "assistant") {
            insertIndex = i;
            break;
          }
          if (entry.kind === "run") {
            const run = runs.find((item) => item.id === entry.runId);
            if (run && run.status === "complete") {
              insertIndex = i;
              break;
            }
          }
        }
        if (insertIndex === -1) return prev;
        const next = [...prev];
        next.splice(insertIndex + 1, 0, { kind: "snapshot", snapshot });
        return next;
      });
    },
    [runs]
  );

  useEffect(() => {
    const draftIsInFlight =
      draftSnapshot && draftSnapshot.id === inFlightSnapshotIdRef.current;

    if (!hasAnswer) {
      if (draftSnapshot && !draftIsInFlight) {
        if (getSnapshotSignature(draftSnapshot) !== selectionSignature) {
          updateSnapshotInTimeline(draftSnapshot.id, (existing) => ({
            ...existing,
            selectionMode,
            selectedModelIds: selectionModelIds,
            aggregatorModelId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
            status: "draft",
            appliesTo: "next_message",
          }));
        }
      }
      return;
    }

    if (draftSnapshot && !draftIsInFlight) {
      if (
        lastFinalSnapshot &&
        getSnapshotSignature(lastFinalSnapshot) === selectionSignature
      ) {
        removeSnapshotFromTimeline(draftSnapshot.id);
        return;
      }
      if (getSnapshotSignature(draftSnapshot) !== selectionSignature) {
        updateSnapshotInTimeline(draftSnapshot.id, (existing) => ({
          ...existing,
          selectionMode,
          selectedModelIds: selectionModelIds,
          aggregatorModelId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
          status: "draft",
          appliesTo: "next_message",
        }));
      }
      return;
    }

    if (lastFinalSnapshot && getSnapshotSignature(lastFinalSnapshot) === selectionSignature) {
      return;
    }

    if (draftSnapshot && draftIsInFlight) {
      if (getSnapshotSignature(draftSnapshot) === selectionSignature) {
        return;
      }
    }

    const nextSnapshot = buildSelectionSnapshot();
    insertSnapshotAfterLastAnswer(nextSnapshot);
  }, [
    aggregatorModel,
    buildSelectionSnapshot,
    draftSnapshot,
    getSnapshotSignature,
    hasAnswer,
    insertSnapshotAfterLastAnswer,
    lastFinalSnapshot,
    removeSnapshotFromTimeline,
    selectionMode,
    selectionModelIds,
    selectionSignature,
    updateSnapshotInTimeline,
  ]);

  useEffect(() => {
    allowHistorySaveRef.current = false;
  }, [activeProjectId, chatId]);

  useEffect(() => {
    setAttachments([]);
  }, [activeProjectId, chatId]);

  useEffect(() => {
    if (messages.length === 0) return;
    setTimeline((prev) => {
      const next = [...prev];
      messages.forEach((message) => {
        const index = next.findIndex(
          (entry) => entry.kind === "message" && entry.message.id === message.id
        );
        const existingSnapshotId =
          index >= 0 && next[index].kind === "message"
            ? (next[index].message as Message & { snapshotId?: string }).snapshotId
            : undefined;
        let snapshotId = existingSnapshotId;
        if (!snapshotId) {
          if (message.role === "user") {
            snapshotId =
              pendingUserSnapshotQueueRef.current.shift() ??
              latestSnapshotIdRef.current ??
              undefined;
            if (snapshotId) lastUserSnapshotRef.current = snapshotId;
          } else {
            snapshotId = lastUserSnapshotRef.current ?? latestSnapshotIdRef.current ?? undefined;
          }
        }
        const enrichedMessage = {
          ...message,
          snapshotId,
          optimistic: false,
        } as Message & { snapshotId?: string; optimistic?: boolean; clientMessageId?: string };

        if (message.role === "user") {
          const optimisticIndex = next.findIndex((entry) => {
            if (entry.kind !== "message") return false;
            const entryMessage = entry.message as Message & {
              snapshotId?: string;
              optimistic?: boolean;
              clientMessageId?: string;
              runId?: string;
              createdAt?: string;
            };
            if (entryMessage.role !== "user" || !entryMessage.optimistic) return false;
            if (
              entryMessage.clientMessageId &&
              (message as Message & { clientMessageId?: string }).clientMessageId &&
              entryMessage.clientMessageId ===
                (message as Message & { clientMessageId?: string }).clientMessageId
            ) {
              return true;
            }
            if (
              entryMessage.runId &&
              (message as Message & { runId?: string }).runId &&
              entryMessage.runId === (message as Message & { runId?: string }).runId
            ) {
              return true;
            }
            if (entryMessage.content && message.content && entryMessage.content === message.content)
              return true;
            if (
              entryMessage.content &&
              message.content &&
              entryMessage.createdAt &&
              (message as Message & { createdAt?: string }).createdAt &&
              entryMessage.content === message.content &&
              entryMessage.createdAt === (message as Message & { createdAt?: string }).createdAt
            ) {
              return true;
            }
            if (entryMessage.snapshotId && snapshotId && entryMessage.snapshotId === snapshotId)
              return true;
            return false;
          });
          if (optimisticIndex >= 0) {
            next[optimisticIndex] = { kind: "message", message: enrichedMessage };
          } else if (index >= 0) {
            next[index] = { kind: "message", message: enrichedMessage };
          } else {
            next.push({ kind: "message", message: enrichedMessage });
          }
        } else if (index >= 0) {
          next[index] = { kind: "message", message: enrichedMessage };
        } else {
          next.push({ kind: "message", message: enrichedMessage });
        }
        if (message.role === "assistant") {
          if (snapshotId) {
            updateSnapshotInTimeline(snapshotId, (snapshot) => ({
              ...snapshot,
              status: "final",
              appliesTo: "answered_message_id",
              appliesToMessageId: message.id,
            }));
            inFlightSnapshotIdRef.current = null;
          }
        }
      });
      return next;
    });
  }, [messages, updateSnapshotInTimeline]);

  useEffect(() => {
    if (messages.length > 0) return;
    if (initialTimeline?.length) {
      setTimeline((prev) => {
        if (prev.length > 0) return prev;
        return initialTimeline;
      });
      return;
    }
    if (!initialMessages?.length) return;
    setTimeline((prev) => {
      if (prev.length > 0) return prev;
      return initialMessages.map((message) => ({ kind: "message", message }));
    });
  }, [initialTimeline, initialMessages, messages.length]);

  const timelineMessages = useMemo(
    () => timeline.filter((entry) => entry.kind === "message").map((entry) => entry.message),
    [timeline]
  );
  const lastUserMessage = useMemo(
    () => [...timelineMessages].reverse().find((message) => message.role === "user"),
    [timelineMessages]
  );
  const firstUserMessage = useMemo(
    () => timelineMessages.find((message) => message.role === "user"),
    [timelineMessages]
  );

  const transcriptData = useMemo(() => {
    let subject: SubjectOutput | undefined;
    const routeModels: RouteOutput[] = [];
    const solveQuestions: SolveOutput[] = [];
    const transcript: TranscriptItem[] = [];
    let messageIndex = -1;

    timeline.forEach((entry) => {
      if (entry.kind === "snapshot") {
        transcript.push(entry.snapshot);
        return;
      }

      if (entry.kind === "run") {
        const run = runs.find((item) => item.id === entry.runId);
        if (!run) return;
        const solveOutputs: SolveOutput[] = [];
        run.selectedModels.forEach((modelId) => {
          const result = run.resultsByModel[modelId];
          if (!result || result.status !== "complete") return;
          solveOutputs.push({
            steps: result.text ? result.text.split("\n").filter(Boolean).slice(0, 6) : [],
            final: result.text ?? "",
            model: result.modelId,
            confidence: undefined,
            citations: [],
            durationMs: result.latencyMs,
            selectionReason: "Multi-model run",
            kind: "solve",
          });
        });
        if (run.aggregated?.text) {
          solveOutputs.push({
            steps: run.aggregated.text.split("\n").filter(Boolean).slice(0, 6),
            final: run.aggregated.text,
            model: run.aggregated.attribution?.modelIdsUsed?.[0],
            confidence: run.aggregated.confidence,
            citations: [],
            durationMs: run.timings.endAt ? run.timings.endAt - run.timings.startAt : undefined,
            selectionReason: "Multi-model aggregation",
            kind: "aggregate",
          });
        }
        if (solveOutputs.length > 0) {
          transcript.push({
            role: "assistant",
            content: run.aggregated?.text ?? "",
            snapshotId: run.snapshotId,
            tools: {
              solveQuestions: solveOutputs,
            },
          });
          solveQuestions.push(...solveOutputs);
        }
        return;
      }

      messageIndex += 1;
      const message = entry.message as Message & { snapshotId?: string };
      if (message.role === "user") {
        transcript.push({
          role: "user",
          content: message.content,
          snapshotId: message.snapshotId,
        });
        return;
      }

      const parts = (message as Message & { parts?: any[] }).parts ?? [];
      const overrideTools = toolOverrides?.[message.id] ?? toolOverridesByIndex?.[messageIndex];
      const tools: TranscriptMessage["tools"] = {
        ...(overrideTools ?? {}),
      };

      if (overrideTools) {
        if (overrideTools.detectSubject) {
          subject = overrideTools.detectSubject;
        }
        if (overrideTools.routeModels) {
          routeModels.push(...overrideTools.routeModels);
        }
        if (overrideTools.solveQuestions) {
          solveQuestions.push(...overrideTools.solveQuestions);
        }
      } else {
        parts.forEach((part) => {
          const invocation = getToolInvocationFromPart(part);
          if (!invocation || !isToolResult(invocation)) return;
          const output =
            (invocation as ToolInvocationLike).result ?? (invocation as ToolInvocationLike).output;

          if (invocation.toolName === "detectSubject") {
            subject = output as SubjectOutput;
            tools.detectSubject = subject;
          }
          if (invocation.toolName === "routeModel") {
            const routeOutput = output as RouteOutput;
            routeModels.push(routeOutput);
            tools.routeModels = [...(tools.routeModels ?? []), routeOutput];
          }
          if (invocation.toolName === "solveQuestion") {
            if (Array.isArray(output)) {
              solveQuestions.push(...(output as SolveOutput[]));
              tools.solveQuestions = [...(tools.solveQuestions ?? []), ...(output as SolveOutput[])];
            } else if (output && typeof output === "object" && "solves" in (output as Record<string, unknown>)) {
              const payload = output as { solves?: SolveOutput[]; aggregate?: SolveOutput };
              if (payload.solves) {
                solveQuestions.push(...payload.solves);
              }
              if (payload.aggregate) {
                solveQuestions.push(payload.aggregate);
              }
              tools.solveQuestions = [
                ...(tools.solveQuestions ?? []),
                ...(payload.solves ?? []),
                ...(payload.aggregate ? [payload.aggregate] : []),
              ];
            } else {
              const solveOutput = output as SolveOutput;
              solveQuestions.push(solveOutput);
              tools.solveQuestions = [...(tools.solveQuestions ?? []), solveOutput];
            }
          }
        });
      }

      transcript.push({
        role: "assistant",
        content: extractAssistantText(message),
        snapshotId: message.snapshotId,
        tools,
      });
    });

    return { transcript, subject, routeModels, solveQuestions };
  }, [timeline, toolOverrides, toolOverridesByIndex, runs]);

  const lastSavedKey = useRef("");
  useEffect(() => {
    if (timelineMessages.length === 0) return;
    const entryId = activeProjectId ?? chatId;
    const lastUser = [...timelineMessages].reverse().find((message) => message.role === "user");
    if (!lastUser) return;
    if (activeProjectId && !allowHistorySaveRef.current) return;
    const modelList = Array.from(
      new Set(
        [
          ...transcriptData.solveQuestions.map((solve) => solve.model),
          ...transcriptData.routeModels.map((route) => route.model),
        ].filter((model): model is string => Boolean(model))
      )
    );
    const lastModel =
      transcriptData.solveQuestions[transcriptData.solveQuestions.length - 1]?.model ??
      transcriptData.routeModels[transcriptData.routeModels.length - 1]?.model ??
      "Nexus-Core";
    const snapshotKey = [
      entryId,
      timelineMessages.length,
      transcriptData.solveQuestions.length,
      transcriptData.routeModels.length,
      transcriptData.subject?.subject ?? "",
      lastModel,
    ].join("|");
    if (snapshotKey === lastSavedKey.current) return;
    lastSavedKey.current = snapshotKey;
    const baseQuestion = firstUserMessage?.content ?? lastUser.content;
    const nextEntries = upsertHistoryEntry({
      id: entryId,
      question: baseQuestion,
      subject: transcriptData.subject?.subject ?? "General",
      model: lastModel,
      models: modelList.length > 0 ? modelList : [lastModel],
      transcript: transcriptData.transcript,
      mode,
      createdAt: new Date().toISOString(),
    });
    onProjectSaved(nextEntries);
  }, [timelineMessages, transcriptData, activeProjectId, chatId, mode, onProjectSaved]);

  const runsRef = useRef<MultiModelRun[]>([]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const updateRun = useCallback(
    (runId: string, updater: (run: MultiModelRun) => MultiModelRun) => {
      setRuns((prev) => prev.map((run) => (run.id === runId ? updater(run) : run)));
    },
    []
  );

  const clearSendState = useCallback(() => {
    isSendingRef.current = false;
    currentSendIdRef.current = null;
    pendingClientMessageIdRef.current = null;
    sendGuardRef.current = false;
  }, []);

  const startMultiRun = async (plan: ExecutionPlan, clientMessageId: string) => {
    const selectedModels = Array.from(new Set(plan.modelIds));
    if (selectedModels.length < 2) {
      clearSendState();
      return;
    }
    const runKey = buildRunKeyFromPlan(plan);
    if (pendingRunKeysRef.current.has(runKey)) return;
    pendingRunKeysRef.current.add(runKey);

    const runId = plan.runId;
    runKeyByIdRef.current.set(runId, runKey);
    const userMessage: Message & {
      snapshotId?: string;
      optimistic?: boolean;
      clientMessageId?: string;
      runId?: string;
      createdAt?: string;
    } = {
      id: clientMessageId,
      role: "user",
      content: plan.question,
      snapshotId: plan.snapshotId ?? undefined,
      optimistic: true,
      clientMessageId,
      runId,
      createdAt: new Date(plan.createdAt).toISOString(),
    };
    const initialResults: Record<string, ModelResult> = {};
    selectedModels.forEach((modelId) => {
      initialResults[modelId] = {
        modelId,
        status: "running",
      };
    });

    const run: MultiModelRun = {
      id: runId,
      runId,
      queryText: plan.question,
      status: "running",
      selectedModels,
      resultsByModel: initialResults,
      aggregated: undefined,
      executionPlan: plan,
      snapshotId: plan.snapshotId ?? undefined,
      timings: { startAt: Date.now() },
      counts: { total: selectedModels.length, complete: 0, failed: 0, cancelled: 0 },
      showIndividual: true,
      collapsed: true,
    };

    setRuns((prev) => [...prev, run]);
    setTimeline((prev) => [...prev, { kind: "message", message: userMessage }, { kind: "run", runId }]);
    setQuestion("");
    setAttachments([]);
    onClearSavedNotice();

    const controllerMap = new Map<string, AbortController>();
    runControllersRef.current.set(runId, controllerMap);

    const modelMessages = [{ role: "user", content: plan.question }] as Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }>;

    const tasks = selectedModels.map(async (modelId) => {
      const controller = new AbortController();
      controllerMap.set(modelId, controller);
      try {
        const result = await runModel({
          modelId,
          messages: modelMessages,
          mode: plan.mode,
          signal: controller.signal,
          attachments: plan.attachments,
        });
        updateRun(runId, (prevRun) => {
          const nextResults = {
            ...prevRun.resultsByModel,
            [modelId]: {
              modelId,
              status: "complete",
              latencyMs: result.latencyMs,
              tokensIn: result.tokensIn,
              tokensOut: result.tokensOut,
              text: result.text,
            },
          };
          const counts = Object.values(nextResults).reduce(
            (acc, current) => {
              if (current.status === "complete") acc.complete += 1;
              if (current.status === "error") acc.failed += 1;
              if (current.status === "cancelled") acc.cancelled += 1;
              return acc;
            },
            { total: selectedModels.length, complete: 0, failed: 0, cancelled: 0 }
          );
          return {
            ...prevRun,
            resultsByModel: nextResults,
            counts,
          };
        });
      } catch (error) {
        updateRun(runId, (prevRun) => {
          const nextResults = {
            ...prevRun.resultsByModel,
            [modelId]: {
              modelId,
              status: controller.signal.aborted ? "cancelled" : "error",
              errorMessage: (error as Error)?.message ?? "Model failed.",
            },
          };
          const counts = Object.values(nextResults).reduce(
            (acc, current) => {
              if (current.status === "complete") acc.complete += 1;
              if (current.status === "error") acc.failed += 1;
              if (current.status === "cancelled") acc.cancelled += 1;
              return acc;
            },
            { total: selectedModels.length, complete: 0, failed: 0, cancelled: 0 }
          );
          return {
            ...prevRun,
            resultsByModel: nextResults,
            counts,
          };
        });
      }
    });

    Promise.allSettled(tasks)
      .then(async () => {
        const currentRun = runsRef.current.find((item) => item.id === runId);
        if (!currentRun) return;
        if (currentRun.status === "cancelled") {
          inFlightSnapshotIdRef.current = null;
          return;
        }
        const successful = Object.values(currentRun.resultsByModel).filter(
          (result) => result.status === "complete" && result.text
        );

        const nextStatus = successful.length > 0 ? "complete" : "error";
        updateRun(runId, (prevRun) => ({
          ...prevRun,
          status: nextStatus,
          timings: { ...prevRun.timings, endAt: Date.now() },
        }));

        if (successful.length > 0) {
          const aggregate = await runAggregator({
            question: plan.question,
            results: successful.map((result) => ({
              modelId: result.modelId,
              text: result.text ?? "",
            })),
            aggregatorModel: plan.aggregatorId,
            attachments: plan.attachments,
          });
          updateRun(runId, (prevRun) => ({
            ...prevRun,
            aggregated: aggregate,
          }));
          if (currentRun.snapshotId) {
            updateSnapshotInTimeline(currentRun.snapshotId, (snapshot) => ({
              ...snapshot,
              status: "final",
              appliesTo: "answered_message_id",
              appliesToMessageId: `run-${runId}`,
            }));
          }
        }
        inFlightSnapshotIdRef.current = null;
        clearSendState();
      })
      .finally(() => {
        runControllersRef.current.delete(runId);
        pendingRunKeysRef.current.delete(runKey);
        runKeyByIdRef.current.delete(runId);
      });
  };

  const handleRoute = async () => {
    const trimmed = question.trim();
    if (
      !trimmed ||
      sendGuardRef.current ||
      isBusy ||
      isSendingRef.current ||
      currentSendIdRef.current
    ) {
      return;
    }
    if (
      lastSubmittedQuestionRef.current === trimmed &&
      lastSubmittedRevisionRef.current === questionRevisionRef.current
    ) {
      return;
    }
    const clientMessageId =
      pendingClientMessageIdRef.current ??
      (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
    sendGuardRef.current = true;
    lastSubmittedQuestionRef.current = trimmed;
    lastSubmittedRevisionRef.current = questionRevisionRef.current;
    if (activeProjectId) {
      allowHistorySaveRef.current = true;
    }
    let snapshotToUse = draftSnapshot ?? lastFinalSnapshot ?? latestSnapshot;
    if (!snapshotToUse) {
      const snapshot = buildSelectionSnapshot();
      snapshotToUse = snapshot;
      latestSnapshotIdRef.current = snapshot.id;
      setTimeline((prev) => [...prev, { kind: "snapshot", snapshot }]);
    }
    if (snapshotToUse?.id) {
      inFlightSnapshotIdRef.current = snapshotToUse.id;
    }
    if (!multiMode && snapshotToUse?.id) {
      pendingUserSnapshotQueueRef.current.push(snapshotToUse.id);
      lastUserSnapshotRef.current = snapshotToUse.id;
    }
    const plan: ExecutionPlan = {
      runId: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      question: trimmed,
      modelIds: [...effectiveSelectedModels],
      aggregatorId: aggregatorModel !== "auto" ? aggregatorModel : undefined,
      snapshotId: snapshotToUse?.id ?? undefined,
      createdAt: Date.now(),
      mode,
      attachments: attachments.map((item) => ({ ...item })),
    };
    const runKey = buildRunKeyFromPlan(plan);
    const now = Date.now();
    if (lastRunRef.current.key === runKey && now - lastRunRef.current.at < 1500) return;
    if (pendingRunKeysRef.current.has(runKey)) return;
    lastRunRef.current = { key: runKey, at: now };

    if (timeline.some((entry) => entry.kind === "message" && entry.message.id === clientMessageId)) {
      if (duplicateSendWarnIdRef.current !== clientMessageId) {
        duplicateSendWarnIdRef.current = clientMessageId;
        console.warn("[StudioChat] Duplicate send blocked for clientMessageId:", clientMessageId);
      }
      return;
    }
    pendingClientMessageIdRef.current = clientMessageId;
    isSendingRef.current = true;
    currentSendIdRef.current = clientMessageId;
    if (multiMode) {
      await startMultiRun(plan, clientMessageId);
      return;
    }
    await append({
      id: clientMessageId,
      role: "user",
      content: trimmed,
      snapshotId: snapshotToUse?.id,
      optimistic: true,
      clientMessageId,
      runId: plan.runId,
      createdAt: new Date(plan.createdAt).toISOString(),
    } as Message & {
      snapshotId?: string;
      optimistic?: boolean;
      clientMessageId?: string;
      runId?: string;
      createdAt?: string;
    });
    setQuestion("");
    setAttachments([]);
    onClearSavedNotice();
  };

  const cancelRun = useCallback(
    (runId: string) => {
      const controllers = runControllersRef.current.get(runId);
      controllers?.forEach((controller) => controller.abort());
      runControllersRef.current.delete(runId);
      const runKey = runKeyByIdRef.current.get(runId);
      if (runKey) {
        pendingRunKeysRef.current.delete(runKey);
        runKeyByIdRef.current.delete(runId);
      }
      const activeRun = runsRef.current.find((run) => run.id === runId);
      if (activeRun?.snapshotId && inFlightSnapshotIdRef.current === activeRun.snapshotId) {
        inFlightSnapshotIdRef.current = null;
      }
      clearSendState();
      updateRun(runId, (prevRun) => {
        const nextResults = { ...prevRun.resultsByModel };
        Object.values(nextResults).forEach((result) => {
          if (result.status === "running") {
            result.status = "cancelled";
          }
        });
        const counts = Object.values(nextResults).reduce(
          (acc, current) => {
            if (current.status === "complete") acc.complete += 1;
            if (current.status === "error") acc.failed += 1;
            if (current.status === "cancelled") acc.cancelled += 1;
            return acc;
          },
          { total: prevRun.selectedModels.length, complete: 0, failed: 0, cancelled: 0 }
        );
        return {
          ...prevRun,
          status: "cancelled",
          resultsByModel: nextResults,
          counts,
          timings: { ...prevRun.timings, endAt: Date.now() },
        };
      });
    },
    [clearSendState, updateRun]
  );

  const handleCancel = () => {
    if (multiMode) {
      const activeRun = runs.find((run) => run.status === "running");
      if (activeRun) cancelRun(activeRun.id);
      return;
    }
    stop();
  };

  const compareRun = compareRunId ? runs.find((run) => run.id === compareRunId) ?? null : null;
  const hasRunningRun = runs.some((run) => run.status === "running");
  const isBusy = isLoading || hasRunningRun;

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: PdfAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!isPdfFile(file)) continue;
      try {
        const attachment = await fileToAttachment(file);
        next.push(attachment);
      } catch {
        // Ignore failed attachment reads
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  useEffect(() => {
    if (!isBusy && !currentSendIdRef.current) {
      sendGuardRef.current = false;
    }
  }, [isBusy]);

  useEffect(() => {
    sendGuardRef.current = false;
    isSendingRef.current = false;
    pendingClientMessageIdRef.current = null;
    duplicateSendWarnIdRef.current = null;
    currentSendIdRef.current = null;
    pendingRunKeysRef.current.clear();
    runKeyByIdRef.current.clear();
    runControllersRef.current.clear();
    lastRunRef.current = { key: "", at: 0 };
    lastSubmittedQuestionRef.current = "";
    lastSubmittedRevisionRef.current = -1;
    inFlightSnapshotIdRef.current = null;
    pendingUserSnapshotQueueRef.current = [];
    lastUserSnapshotRef.current = null;
  }, [activeProjectId, chatId]);

  const handleNewProject = () => {
    if (isLoading) return;
    if (!lastUserMessage) {
      onReset(false);
      return;
    }

    const modelList = Array.from(
      new Set(
        [...transcriptData.solveQuestions.map((solve) => solve.model), ...transcriptData.routeModels.map((route) => route.model)]
          .filter((model): model is string => Boolean(model))
      )
    );

    const lastModel =
      transcriptData.solveQuestions[transcriptData.solveQuestions.length - 1]?.model ??
      transcriptData.routeModels[transcriptData.routeModels.length - 1]?.model ??
      "Nexus-Core";

    const entryId = activeProjectId ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
    const nextEntries = upsertHistoryEntry({
      id: entryId,
      question: firstUserMessage?.content ?? lastUserMessage.content,
      subject: transcriptData.subject?.subject ?? "General",
      model: lastModel,
      models: modelList.length > 0 ? modelList : [lastModel],
      transcript: transcriptData.transcript,
      mode,
      createdAt: new Date().toISOString(),
    });

    onProjectSaved(nextEntries);
    onReset(true);
  };

  const lastNewProjectRequest = useRef(newProjectRequest);
  useEffect(() => {
    if (newProjectRequest !== lastNewProjectRequest.current) {
      lastNewProjectRequest.current = newProjectRequest;
      handleNewProject();
    }
  }, [newProjectRequest]);


  const summarizeAggregated = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const sentence = trimmed.split(/\.(\s|$)/)[0];
    const summary = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
    return summary.endsWith(".") ? summary : `${summary}.`;
  }, []);

  return (
    <YStack flex={1} gap="$md">
      <YStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        padding="$lg"
        gap="$md"
        minHeight={80}
      >
        <YStack gap="$md">
          <YStack gap="$md">
            {!hasAnswer && (
              <CurrentSelectionPanel
                selectionMode={selectionMode}
                selectedModelIds={selectionModelIds}
                aggregatorModelId={aggregatorModel !== "auto" ? aggregatorModel : undefined}
                modelMetaMap={modelMetaMap}
                modelNameMap={modelNameMap}
              />
            )}
            {(() => {
              let messageIndex = -1;
              const finalizedSnapshotsByMessage = new Map<string, ModelSelectionSnapshot>();
              timeline.forEach((entry) => {
                if (entry.kind !== "snapshot") return;
                if (entry.snapshot.status !== "final") return;
                const appliesToId = entry.snapshot.appliesToMessageId;
                if (appliesToId) finalizedSnapshotsByMessage.set(appliesToId, entry.snapshot);
              });
              return timeline.map((entry) => {
                if (entry.kind === "message") {
                  messageIndex += 1;
                  const message = entry.message;
                  const fallbackTools = toolOverridesByIndex?.[messageIndex];
                  if (message.role === "user") {
                    return (
                      <XStack key={message.id} justifyContent="flex-end">
                        <YStack
                          maxWidth="80%"
                          padding="$sm"
                          borderRadius="$md"
                          backgroundColor="$backgroundSecondary"
                          borderWidth={1}
                          borderColor="$border"
                        >
                          <Paragraph fontSize={14} color="$color">
                            {message.content}
                          </Paragraph>
                        </YStack>
                      </XStack>
                    );
                  }

                  const snapshot = finalizedSnapshotsByMessage.get(message.id);
                  return (
                    <YStack key={message.id} maxWidth="80%" gap="$sm">
                      {snapshot && (
                        <ModelSelectionSnapshotBlock
                          snapshot={snapshot}
                          modelMetaMap={modelMetaMap}
                          modelNameMap={modelNameMap}
                        />
                      )}
                      <AssistantMessage
                        message={message}
                        toolOverride={toolOverrides?.[message.id] ?? fallbackTools}
                        showSteps={showSteps}
                        showCitations={showCitations}
                        globalCollapsed={collapseAll}
                      />
                    </YStack>
                  );
                }

                if (entry.kind === "snapshot") {
                  if (entry.snapshot.status === "final" && entry.snapshot.appliesToMessageId) {
                    return null;
                  }
                  return (
                    <YStack key={entry.snapshot.id} maxWidth="100%">
                      <ModelSelectionSnapshotBlock
                        snapshot={entry.snapshot}
                        modelMetaMap={modelMetaMap}
                        modelNameMap={modelNameMap}
                      />
                    </YStack>
                  );
                }

                const run = runs.find((item) => item.id === entry.runId);
                if (!run) return null;
                const summary = run.aggregated?.text
                  ? summarizeAggregated(run.aggregated.text)
                  : "Consulting multiple AI models...";
                const assistantLine =
                  run.status === "complete" && run.aggregated?.text
                    ? `Based on consulting multiple AI models, ${summary}`
                    : summary;

                const runSnapshot = finalizedSnapshotsByMessage.get(`run-${run.id}`);
                return (
                  <YStack key={run.id} maxWidth="100%" gap="$sm">
                    {runSnapshot && (
                      <ModelSelectionSnapshotBlock
                        snapshot={runSnapshot}
                        modelMetaMap={modelMetaMap}
                        modelNameMap={modelNameMap}
                      />
                    )}
                    <YStack
                      maxWidth="80%"
                      padding="$sm"
                      borderRadius="$md"
                      backgroundColor="$background"
                      borderWidth={1}
                      borderColor="$border"
                    >
                      <Paragraph fontSize={14} color="$color">
                        {assistantLine}
                      </Paragraph>
                    </YStack>

                    {!run.collapsed && (
                      <MultiModelRunPanel
                        run={run}
                        onCompare={() => {
                          setCompareRunId(run.id);
                          setCompareSelected([]);
                        }}
                        onToggleIndividual={() =>
                          updateRun(run.id, (prevRun) => ({
                            ...prevRun,
                            showIndividual: !prevRun.showIndividual,
                          }))
                        }
                        onToggleCollapse={() =>
                          updateRun(run.id, (prevRun) => ({
                            ...prevRun,
                            collapsed: !prevRun.collapsed,
                          }))
                        }
                      />
                    )}
                    <AggregatedResponseCard
                      run={run}
                      onToggleCollapse={() =>
                        updateRun(run.id, (prevRun) => ({
                          ...prevRun,
                          collapsed: !prevRun.collapsed,
                        }))
                      }
                    />
                    {!run.collapsed && run.showIndividual && (
                      <IndividualResponsesGrid
                        results={run.selectedModels
                          .map((modelId) => run.resultsByModel[modelId])
                          .filter(Boolean) as ModelResult[]}
                        modelNameMap={modelNameMap}
                        modelMetaMap={modelMetaMap}
                        onCopy={(modelId) => {
                          const text = run.resultsByModel[modelId]?.text ?? "";
                          navigator.clipboard.writeText(text);
                        }}
                        onExpand={(modelId) => {
                          setCompareRunId(run.id);
                          setCompareSelected([modelId]);
                        }}
                      />
                    )}
                  </YStack>
                );
              });
            })()}
          </YStack>
        </YStack>
      </YStack>

      <YStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        padding="$sm"
        backgroundColor="$background"
      >
        {activeProjectId && (
          <Text fontSize={12} color="$textMuted" marginBottom="$xs">
            Continuing project {activeProjectId.slice(0, 6).toUpperCase()}
          </Text>
        )}
        {justSaved && (
          <YStack
            marginBottom="$xs"
            padding="$sm"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$sm"
            backgroundColor="$backgroundSecondary"
          >
            <Text fontSize={12} color="$textMuted">
              Saved to Projects. Ask a new homework question below.
            </Text>
          </YStack>
        )}
        <CompactComposer
          value={question}
          onChange={(value) => {
            questionRevisionRef.current += 1;
            setQuestion(value);
            if (justSaved) onClearSavedNotice();
          }}
          onSend={handleRoute}
          onStop={handleCancel}
          isBusy={isBusy}
          attachments={attachments}
          onRemoveAttachment={(index) =>
            setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
          }
          onFilesSelected={(files) => void handleAttachFiles(files)}
          showCitations={showCitations}
          showSteps={showSteps}
          mode={mode}
          onToggleCitations={onToggleCitations}
          onToggleSteps={onToggleSteps}
          onModeChange={onModeChange}
          stackCount={stackCount}
          isDefaultStack={isDefaultStack}
        />
      </YStack>

      <CompareOverlay
        open={Boolean(compareRun)}
        run={compareRun}
        modelNameMap={modelNameMap}
        initialSelected={compareSelected}
        onClose={() => {
          setCompareRunId(null);
          setCompareSelected([]);
        }}
      />
    </YStack>
  );
}

export default function StudioPage() {
  const [mode, setMode] = useState<"fast" | "deep">("fast");
  const [showSteps, setShowSteps] = useState(true);
  const [showCitations, setShowCitations] = useState(true);
  const [collapseAll, setCollapseAll] = useState(true);
  const multiMode = true;
  const [newProjectRequest, setNewProjectRequest] = useState(0);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [labPresets, setLabPresets] = useState<LabPreset[]>([]);
  const modelCatalog = useMemo(() => getModelHubCards(), []);
  const modelNameMap = useMemo(() => getModelNameMap(), []);
  const modelMetaMap = useMemo(() => new Map(modelCatalog.map((model) => [model.id, model])), [modelCatalog]);

  useEffect(() => {
    setLabPresets(loadLabPresets());
    const handler = () => setLabPresets(loadLabPresets());
    window.addEventListener("lab-presets-updated", handler);
    return () => window.removeEventListener("lab-presets-updated", handler);
  }, []);
  const [preferredModels, setPreferredModels] = useState<string[]>([]);
  const [aggregatorModel, setAggregatorModel] = useState("auto");
  const initialChatId = useId();
  const [chatId, setChatId] = useState(initialChatId);
  const [justSaved, setJustSaved] = useState(false);
  const [projects, setProjects] = useState<HistoryEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    setProjects(loadHistory());
  }, []);

  useEffect(() => {
    const projectId = searchParams.get("project");
    setSelectedProjectId(projectId);
  }, [searchParams]);

  useEffect(() => {
    const stackParam = searchParams.get("stack");
    if (!stackParam) return;
    const nextStack = stackParam
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (nextStack.length > 0) {
      setPreferredModels(nextStack);
      setSelectedProjectId(null);
      router.replace("/studio");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (selectedProjectId) {
      setChatId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleReset = (saved: boolean) => {
    setJustSaved(saved);
    setChatId(typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
    setSelectedProjectId(null);
    router.replace("/studio");
  };

  const handleClearSavedNotice = () => {
    if (justSaved) setJustSaved(false);
  };

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const lower = projectSearch.toLowerCase();
    return projects.filter(
      (project) =>
        project.question.toLowerCase().includes(lower) ||
        project.subject.toLowerCase().includes(lower) ||
        project.models.join(" ").toLowerCase().includes(lower)
    );
  }, [projectSearch, projects]);

  const groupedProjects = useMemo(
    () =>
      filteredProjects.filter(
        (project) => (project.models?.length ?? 0) > 1 || project.subject === "Model Hub Compare"
      ),
    [filteredProjects]
  );

  const ungroupedProjects = useMemo(
    () =>
      filteredProjects.filter(
        (project) => !((project.models?.length ?? 0) > 1 || project.subject === "Model Hub Compare")
      ),
    [filteredProjects]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const handleProjectSaved = useCallback((entries: HistoryEntry[]) => {
    setProjects(entries);
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const initialMessages = useMemo(() => {
    if (!activeProject) return undefined;
    let messageIndex = 0;
    return activeProject.transcript
      .filter((item): item is TranscriptMessage => "role" in item)
      .map((message) => ({
        id: `${activeProject.id}-${messageIndex++}`,
        role: message.role,
        content: message.content ?? "",
        snapshotId: message.snapshotId,
      }));
  }, [activeProject]);

  const initialTimeline = useMemo(() => {
    if (!activeProject) return undefined;
    let messageIndex = 0;
    return activeProject.transcript
      .map((item) => {
        if ("type" in item && item.type === "model_selection_snapshot") {
          return { kind: "snapshot", snapshot: item };
        }
        if ("role" in item) {
          const message = item;
          return {
            kind: "message",
            message: {
              id: `${activeProject.id}-${messageIndex++}`,
              role: message.role,
              content: message.content ?? "",
              snapshotId: message.snapshotId,
            } as Message & { snapshotId?: string },
          };
        }
        return null;
      })
      .filter((entry): entry is ChatEntry => Boolean(entry));
  }, [activeProject]);

  const toolOverrides = useMemo(() => {
    if (!activeProject) return undefined;
    let messageIndex = 0;
    return activeProject.transcript.reduce<Record<string, TranscriptMessage["tools"]>>((acc, item) => {
      if ("role" in item) {
        const currentId = `${activeProject.id}-${messageIndex++}`;
        if (item.role === "assistant" && item.tools) {
          acc[currentId] = item.tools;
        }
      }
      return acc;
    }, {});
  }, [activeProject]);

  const toolOverridesByIndex = useMemo(() => {
    if (!activeProject) return undefined;
    return activeProject.transcript
      .filter((item): item is TranscriptMessage => "role" in item)
      .map((message) => (message.role === "assistant" ? message.tools : undefined));
  }, [activeProject]);

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />

      <YStack flex={1} padding="$xl" maxWidth={1400} marginHorizontal="auto" width="100%">
        <YStack marginBottom="$lg">
          <H1 fontSize={32} fontWeight="700" color="$color" marginBottom="$sm">
            Studio
          </H1>
          <Paragraph color="$textMuted" fontSize={16} maxWidth={720}>
            Paste a homework question. Nexus detects the subject, routes it to the
            best model, and returns a structured answer with attribution.
          </Paragraph>
        </YStack>

        <XStack gap="$lg" flexWrap="nowrap">
          {!navCollapsed && (
            <YStack
              width={300}
              minWidth={260}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              padding="$md"
              gap="$sm"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={16} fontWeight="600" color="$color">
                  Previous 30 days
                </Text>
                <XStack gap="$xs">
                  <Button
                    size="$2"
                    backgroundColor="$backgroundSecondary"
                    borderWidth={1}
                    borderColor="$border"
                    color="$color"
                    onPress={() => setNewProjectRequest((prev) => prev + 1)}
                  >
                    +
                  </Button>
                  <Button
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor="$border"
                    color="$color"
                    onPress={() => setNavCollapsed(true)}
                  >
                    Hide
                  </Button>
                </XStack>
              </XStack>
              <Input
                value={projectSearch}
                onChangeText={setProjectSearch}
                placeholder="Search projects..."
                borderColor="$border"
                backgroundColor="$background"
                fontSize={14}
              />

              <YStack gap="$xs" flex={1}>
                <Text fontSize={12} color="$textMuted">
                  Grouped
                </Text>
                {groupedProjects.length === 0 ? (
                  <Paragraph fontSize={13} color="$textMuted">
                    No grouped chats yet.
                  </Paragraph>
                ) : (
                  groupedProjects.map((project) => {
                    const isActive = project.id === selectedProjectId;
                    return (
                      <Button
                        key={project.id}
                        size="$3"
                        backgroundColor={isActive ? "$backgroundSecondary" : "transparent"}
                        borderWidth={1}
                        borderColor="$border"
                        justifyContent="flex-start"
                        onPress={() => {
                          setSelectedProjectId(project.id);
                          router.push(`/studio?project=${project.id}`);
                          if (justSaved) setJustSaved(false);
                        }}
                      >
                        <YStack alignItems="flex-start" gap="$xs">
                          <Text fontSize={13} fontWeight="600" color="$color">
                            {getProjectQuestion(project).length > 42
                              ? `${getProjectQuestion(project).slice(0, 42)}...`
                              : getProjectQuestion(project)}
                          </Text>
                          <XStack gap="$sm" flexWrap="wrap">
                            <Text fontSize={11} color="$textMuted">
                              {project.subject}
                            </Text>
                            <Text fontSize={11} color="$textMuted">
                              {formatProjectDate(project.createdAt)}
                            </Text>
                          </XStack>
                        </YStack>
                      </Button>
                    );
                  })
                )}
              </YStack>

              <YStack gap="$xs" flex={1} marginTop="$md">
                <Text fontSize={12} color="$textMuted">
                  Ungrouped
                </Text>
                {ungroupedProjects.length === 0 ? (
                  <Paragraph fontSize={13} color="$textMuted">
                    No ungrouped chats yet.
                  </Paragraph>
                ) : (
                  ungroupedProjects.map((project) => {
                    const isActive = project.id === selectedProjectId;
                    return (
                      <Button
                        key={project.id}
                        size="$3"
                        backgroundColor={isActive ? "$backgroundSecondary" : "transparent"}
                        borderWidth={1}
                        borderColor="$border"
                        justifyContent="flex-start"
                        onPress={() => {
                          setSelectedProjectId(project.id);
                          router.push(`/studio?project=${project.id}`);
                          if (justSaved) setJustSaved(false);
                        }}
                      >
                        <YStack alignItems="flex-start" gap="$xs">
                          <Text fontSize={13} fontWeight="600" color="$color">
                            {getProjectQuestion(project).length > 42
                              ? `${getProjectQuestion(project).slice(0, 42)}...`
                              : getProjectQuestion(project)}
                          </Text>
                          <XStack gap="$sm" flexWrap="wrap">
                            <Text fontSize={11} color="$textMuted">
                              {project.subject}
                            </Text>
                            <Text fontSize={11} color="$textMuted">
                              {formatProjectDate(project.createdAt)}
                            </Text>
                          </XStack>
                        </YStack>
                      </Button>
                    );
                  })
                )}
              </YStack>
            </YStack>
          )}

          <YStack flex={1} minWidth={320}>
            {navCollapsed && (
              <XStack justifyContent="flex-start" marginBottom="$sm">
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="$border"
                  color="$color"
                  onPress={() => setNavCollapsed(false)}
                >
                  Show history
                </Button>
              </XStack>
            )}
            <YStack
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              padding="$sm"
              marginBottom="$md"
              gap="$sm"
            >
              <Text fontSize={12} color="$textMuted">
                Controls
              </Text>
              <XStack gap="$sm" flexWrap="wrap">
                <YStack gap="$xs" minWidth={240}>
                  <Text fontSize={12} color="$textMuted">
                    Model hub stack
                  </Text>
                  <AgentStackPicker
                    selectedIds={preferredModels}
                    onChange={setPreferredModels}
                    models={modelCatalog}
                    presets={labPresets}
                    defaultCount={DEFAULT_MULTI_MODELS.length}
                  />
                  <Text fontSize={11} color="$textMuted">
                    {preferredModels.length >= 2
                      ? `Stacked models: ${preferredModels.length}`
                      : `Defaulting to ${DEFAULT_MULTI_MODELS.length} routers.`}
                  </Text>
                </YStack>
                <YStack gap="$xs" minWidth={200}>
                  <Text fontSize={12} color="$textMuted">
                    Aggregator
                  </Text>
                  <AgentPicker
                    value={aggregatorModel}
                    onChange={setAggregatorModel}
                    models={modelCatalog}
                  />
                  <Text fontSize={11} color="$textMuted">
                    Chooses the model that summarizes the stack.
                  </Text>
                </YStack>
              </XStack>
            </YStack>
            <StudioChat
              key={chatId}
              chatId={chatId}
              mode={mode}
              onReset={handleReset}
              justSaved={justSaved}
              onClearSavedNotice={handleClearSavedNotice}
              onProjectSaved={handleProjectSaved}
              initialMessages={initialMessages}
              initialTimeline={initialTimeline}
              toolOverrides={toolOverrides}
              toolOverridesByIndex={toolOverridesByIndex}
              activeProjectId={selectedProjectId}
              showSteps={showSteps}
              showCitations={showCitations}
              collapseAll={collapseAll}
              multiMode={multiMode}
              preferredModels={preferredModels}
              onPreferredModelsChange={setPreferredModels}
              onToggleCitations={() => setShowCitations((prev) => !prev)}
              onToggleSteps={() => setShowSteps((prev) => !prev)}
              onModeChange={setMode}
              aggregatorModel={aggregatorModel}
              onAggregatorModelChange={setAggregatorModel}
              modelCatalog={modelCatalog}
              labPresets={labPresets}
              modelNameMap={modelNameMap}
              modelMetaMap={modelMetaMap}
              newProjectRequest={newProjectRequest}
            />
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}
