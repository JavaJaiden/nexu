"use client";

import { useEffect, useMemo, useState } from "react";
import { Text, XStack, YStack, Button } from "tamagui";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  GitBranch,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { RunPanelProps, ModelResult } from "./types";

type Reaction = "up" | "down" | null;

function formatDuration(startAt: number, endAt?: number): string {
  if (!endAt) return "Running...";
  const ms = endAt - startAt;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatLatency(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: ModelResult["status"] }) {
  if (status === "running") {
    return <Loader2 size={16} color="#9CA3AF" className="spin" />;
  }
  if (status === "error" || status === "cancelled") {
    return <AlertTriangle size={16} color="#F97316" />;
  }
  return <CheckCircle2 size={16} color="#22C55E" />;
}

function ProgressBar({
  complete,
  total,
  failed,
  cancelled,
}: {
  complete: number;
  total: number;
  failed: number;
  cancelled: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const completePct = Math.round((complete / safeTotal) * 100);
  const failedPct = Math.round((failed / safeTotal) * 100);
  const cancelledPct = Math.round((cancelled / safeTotal) * 100);

  return (
    <YStack gap="$xs">
      <XStack height={6} borderRadius="$full" overflow="hidden" backgroundColor="$backgroundSecondary">
        <YStack height="100%" width={`${completePct}%`} backgroundColor="$success" />
        {failedPct > 0 && <YStack height="100%" width={`${failedPct}%`} backgroundColor="$orange10" />}
        {cancelledPct > 0 && <YStack height="100%" width={`${cancelledPct}%`} backgroundColor="$gray8" />}
      </XStack>
      <XStack justifyContent="space-between">
        <Text fontSize={11} color="$textMuted">
          {complete}/{total} complete
        </Text>
        {failed > 0 && (
          <Text fontSize={11} color="$orange10">
            {failed} failed
          </Text>
        )}
        {cancelled > 0 && (
          <Text fontSize={11} color="$gray10">
            {cancelled} cancelled
          </Text>
        )}
      </XStack>
    </YStack>
  );
}

function ModelStackPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "aggregator";
}) {
  const isAggregator = tone === "aggregator";

  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical={4}
      borderRadius="$md"
      borderWidth={1}
      borderColor={isAggregator ? "rgba(34, 197, 94, 0.35)" : "$border"}
      backgroundColor={isAggregator ? "rgba(34, 197, 94, 0.1)" : "$background"}
    >
      {isAggregator && <Sparkles size={11} color="#22C55E" />}
      <Text fontSize={11} fontWeight="600" color={isAggregator ? "$success" : "$color"}>
        {label}
      </Text>
    </XStack>
  );
}

function ModelAnswerCard({
  result,
  modelName,
  showSteps,
  showCitations,
  isExpanded,
  onToggleDetails,
  onCopy,
  onRetry,
  onBranch,
  onThumbUp,
  onThumbDown,
  onReadAloud,
  reaction,
  isReading,
  canReadAloud,
}: {
  result: ModelResult;
  modelName: string;
  showSteps: boolean;
  showCitations: boolean;
  isExpanded: boolean;
  onToggleDetails: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onBranch: () => void;
  onThumbUp: () => void;
  onThumbDown: () => void;
  onReadAloud: () => void;
  reaction: Reaction;
  isReading: boolean;
  canReadAloud: boolean;
}) {
  const isError = result.status === "error" || result.status === "cancelled";
  const hasText = result.status === "complete" && Boolean(result.text?.trim());
  const hasSteps = showSteps && Array.isArray(result.steps) && result.steps.length > 0;
  const hasCitations = showCitations && Array.isArray(result.citations) && result.citations.length > 0;
  const hasMeta =
    typeof result.confidence === "number" ||
    Boolean(result.selectionReason) ||
    Boolean(result.gatewayNote) ||
    Boolean(result.tokensIn) ||
    Boolean(result.tokensOut) ||
    (result.usedModel && result.usedModel !== result.modelId);
  const hasDetails = result.status === "complete" && (hasSteps || hasCitations || hasMeta);

  return (
    <YStack
      flex={1}
      minWidth={280}
      maxWidth={520}
      padding="$lg"
      backgroundColor="$background"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={isError ? "$orange10" : "$border"}
      gap="$md"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$sm" flexWrap="wrap">
        <XStack alignItems="center" gap="$sm" flex={1}>
          <StatusIcon status={result.status} />
          <Text fontSize={15} fontWeight="600" color="$color">
            {modelName}
          </Text>
        </XStack>

        <XStack gap="$xs" alignItems="center">
          <XStack
            padding="$xs"
            paddingHorizontal="$sm"
            backgroundColor="$backgroundSecondary"
            borderRadius="$md"
            alignItems="center"
            gap="$xs"
          >
            <Clock size={12} color="var(--colorTextMuted)" />
            <Text fontSize={11} color="$textMuted">
              {formatLatency(result.latencyMs)}
            </Text>
          </XStack>

          {hasDetails && (
            <Button
              size="$2"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              onPress={onToggleDetails}
              icon={
                isExpanded ? (
                  <ChevronUp size={14} color="var(--colorTextMuted)" />
                ) : (
                  <ChevronDown size={14} color="var(--colorTextMuted)" />
                )
              }
            >
              {isExpanded ? "Hide Details" : "Details"}
            </Button>
          )}
        </XStack>
      </XStack>

      {result.status === "complete" ? (
        <Text fontSize={14} color="$color" lineHeight={1.6} whiteSpace="pre-wrap">
          {result.text ?? "No response"}
        </Text>
      ) : (
        <Text fontSize={14} color="$textMuted">
          {result.errorMessage ?? "Model failed to respond"}
        </Text>
      )}

      <XStack gap="$xs" flexWrap="wrap">
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onCopy}
          disabled={!hasText}
          opacity={hasText ? 1 : 0.45}
          aria-label="Copy model response"
        >
          <Copy size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor={reaction === "up" ? "rgba(34, 197, 94, 0.14)" : "transparent"}
          borderWidth={1}
          borderColor={reaction === "up" ? "$success" : "$border"}
          color={reaction === "up" ? "$success" : "$color"}
          onPress={onThumbUp}
          aria-label="Thumbs up"
        >
          <ThumbsUp size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor={reaction === "down" ? "rgba(239, 68, 68, 0.14)" : "transparent"}
          borderWidth={1}
          borderColor={reaction === "down" ? "$red10" : "$border"}
          color={reaction === "down" ? "$red10" : "$color"}
          onPress={onThumbDown}
          aria-label="Thumbs down"
        >
          <ThumbsDown size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onRetry}
          aria-label="Retry model"
        >
          <RotateCcw size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onBranch}
          disabled={!hasText}
          opacity={hasText ? 1 : 0.45}
          aria-label="Branch in new chat"
        >
          <GitBranch size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onReadAloud}
          disabled={!hasText || !canReadAloud}
          opacity={hasText && canReadAloud ? 1 : 0.45}
          aria-label={isReading ? "Stop reading aloud" : "Read aloud"}
        >
          {isReading ? <VolumeX size={13} color="currentColor" /> : <Volume2 size={13} color="currentColor" />}
        </Button>
      </XStack>

      {hasDetails && isExpanded && (
        <YStack gap="$sm" paddingTop="$sm" borderTopWidth={1} borderColor="$border">
          {hasSteps && (
            <YStack gap="$xs">
              <Text fontSize={12} fontWeight="600" color="$textMuted">
                Steps
              </Text>
              {result.steps!.map((step, index) => (
                <XStack key={index} gap="$sm" alignItems="flex-start">
                  <Text fontSize={12} color="$textMuted" fontWeight="600" minWidth={20}>
                    {index + 1}.
                  </Text>
                  <Text fontSize={13} color="$color" flex={1} lineHeight={1.5}>
                    {step}
                  </Text>
                </XStack>
              ))}
            </YStack>
          )}

          {hasCitations && (
            <YStack gap="$xs">
              <Text fontSize={12} fontWeight="600" color="$textMuted">
                Citations
              </Text>
              {result.citations!.map((citation, index) => (
                <Text key={index} fontSize={12} color="$textMuted">
                  • {citation}
                </Text>
              ))}
            </YStack>
          )}

          {typeof result.confidence === "number" && (
            <Text fontSize={12} color="$success">
              Confidence: {Math.round(result.confidence * 100)}%
            </Text>
          )}

          {result.usedModel && result.usedModel !== result.modelId && (
            <Text fontSize={12} color="$textMuted">
              Routed to: {result.usedModel}
            </Text>
          )}

          {result.selectionReason && (
            <Text fontSize={12} color="$textMuted">
              Selection: {result.selectionReason}
            </Text>
          )}

          {result.gatewayNote && (
            <Text fontSize={12} color="$textMuted">
              Gateway: {result.gatewayNote}
            </Text>
          )}

          {(result.tokensIn || result.tokensOut) && (
            <Text fontSize={12} color="$textMuted">
              Tokens: {result.tokensIn ?? "—"} in • {result.tokensOut ?? "—"} out
            </Text>
          )}
        </YStack>
      )}
    </YStack>
  );
}

function AggregatedCard({
  text,
  isLoading,
  confidence,
  onCopy,
  onRetryAll,
  onBranch,
  onThumbUp,
  onThumbDown,
  onReadAloud,
  reaction,
  isReading,
  canReadAloud,
}: {
  text?: string;
  isLoading: boolean;
  confidence?: number;
  onCopy: () => void;
  onRetryAll: () => void;
  onBranch: () => void;
  onThumbUp: () => void;
  onThumbDown: () => void;
  onReadAloud: () => void;
  reaction: Reaction;
  isReading: boolean;
  canReadAloud: boolean;
}) {
  const hasText = Boolean(text?.trim());

  return (
    <YStack
      padding="$lg"
      backgroundColor="rgba(34, 197, 94, 0.08)"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="rgba(34, 197, 94, 0.3)"
      gap="$sm"
    >
      <XStack alignItems="center" gap="$xs" flexWrap="wrap">
        {isLoading ? (
          <Loader2 size={16} color="#22C55E" className="spin" />
        ) : (
          <Sparkles size={16} color="#22C55E" />
        )}
        <Text fontSize={13} fontWeight="600" color="$success">
          {isLoading ? "Aggregating responses..." : "Aggregated Response"}
        </Text>
        {typeof confidence === "number" && !isLoading && (
          <Text fontSize={12} color="$success" marginLeft="$xs">
            ({Math.round(confidence * 100)}% confidence)
          </Text>
        )}
      </XStack>

      {text ? (
        <Text fontSize={15} fontWeight="500" color="$color" lineHeight={1.6} whiteSpace="pre-wrap">
          {text}
        </Text>
      ) : (
        <Text fontSize={14} color="$textMuted">
          Combining insights from all models...
        </Text>
      )}

      <XStack gap="$xs" flexWrap="wrap">
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onCopy}
          disabled={!hasText}
          opacity={hasText ? 1 : 0.45}
          aria-label="Copy aggregated response"
        >
          <Copy size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor={reaction === "up" ? "rgba(34, 197, 94, 0.14)" : "transparent"}
          borderWidth={1}
          borderColor={reaction === "up" ? "$success" : "$border"}
          color={reaction === "up" ? "$success" : "$color"}
          onPress={onThumbUp}
          aria-label="Thumbs up"
        >
          <ThumbsUp size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor={reaction === "down" ? "rgba(239, 68, 68, 0.14)" : "transparent"}
          borderWidth={1}
          borderColor={reaction === "down" ? "$red10" : "$border"}
          color={reaction === "down" ? "$red10" : "$color"}
          onPress={onThumbDown}
          aria-label="Thumbs down"
        >
          <ThumbsDown size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onRetryAll}
          aria-label="Retry all models"
        >
          <RotateCcw size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onBranch}
          disabled={!hasText}
          opacity={hasText ? 1 : 0.45}
          aria-label="Branch in new chat"
        >
          <GitBranch size={13} color="currentColor" />
        </Button>
        <Button
          size="$1"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$border"
          onPress={onReadAloud}
          disabled={!hasText || !canReadAloud}
          opacity={hasText && canReadAloud ? 1 : 0.45}
          aria-label={isReading ? "Stop reading aloud" : "Read aloud"}
        >
          {isReading ? <VolumeX size={13} color="currentColor" /> : <Volume2 size={13} color="currentColor" />}
        </Button>
      </XStack>
    </YStack>
  );
}

export default function RunPanel({
  run,
  modelNameMap,
  showSteps,
  showCitations,
  onCompare,
  onToggleIndividual,
  onCopy,
  onCopyAggregated,
  onRetryModel,
  onRetryAll,
  onBranchModel,
  onBranchAggregated,
}: RunPanelProps) {
  const results = useMemo(() => run.selectedModels.map((id) => run.resultsByModel[id]).filter(Boolean), [run]);
  const hasErrors = run.counts.failed > 0 || run.counts.cancelled > 0;
  const hasIndividuals = results.length > 0;
  const runModelIds = useMemo(() => {
    const baseIds =
      Array.isArray(run.executionPlan.modelIds) && run.executionPlan.modelIds.length > 0
        ? run.executionPlan.modelIds
        : run.selectedModels;
    return Array.from(new Set(baseIds.filter(Boolean)));
  }, [run.executionPlan.modelIds, run.selectedModels]);
  const canReadAloud = typeof window !== "undefined" && "speechSynthesis" in window;

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [modelReactions, setModelReactions] = useState<Record<string, Reaction>>({});
  const [aggregatedReaction, setAggregatedReaction] = useState<Reaction>(null);
  const [readingTarget, setReadingTarget] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleReaction = (current: Reaction, next: "up" | "down"): Reaction => {
    if (current === next) return null;
    return next;
  };

  const handleToggleCard = (modelId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleReadAloud = (target: string, text?: string) => {
    const spokenText = text?.trim();
    if (!spokenText || !canReadAloud) return;

    if (readingTarget === target) {
      window.speechSynthesis.cancel();
      setReadingTarget(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.onend = () => setReadingTarget((current) => (current === target ? null : current));
    utterance.onerror = () => setReadingTarget((current) => (current === target ? null : current));
    setReadingTarget(target);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <YStack
      gap="$md"
      padding="$lg"
      backgroundColor="$backgroundSecondary"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={hasErrors ? "$orange10" : "$border"}
    >
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack flex={1} gap="$xs">
          <XStack alignItems="center" gap="$sm" flexWrap="wrap">
            {run.status === "running" ? (
              <Loader2 size={18} color="#9CA3AF" className="spin" />
            ) : hasErrors ? (
              <AlertTriangle size={18} color="#F97316" />
            ) : (
              <CheckCircle2 size={18} color="#22C55E" />
            )}
            <Text fontSize={16} fontWeight="600" color="$color">
              {run.status === "running"
                ? "Multi-Model Analysis"
                : hasErrors
                ? "Analysis Complete (Partial)"
                : "Analysis Complete"}
            </Text>

            <XStack gap="$xs" flexWrap="wrap">
              {runModelIds.map((modelId) => (
                <ModelStackPill
                  key={`${run.id}-model-${modelId}`}
                  label={modelNameMap.get(modelId) ?? modelId}
                />
              ))}
              {run.executionPlan.aggregatorId && (
                <ModelStackPill
                  tone="aggregator"
                  label={`Aggregator: ${modelNameMap.get(run.executionPlan.aggregatorId) ?? run.executionPlan.aggregatorId}`}
                />
              )}
            </XStack>
          </XStack>
          <Text fontSize={13} color="$textMuted">
            {run.counts.complete} of {run.counts.total} models responded •{" "}
            {formatDuration(run.timings.startAt, run.timings.endAt)}
          </Text>
        </YStack>

        <XStack gap="$sm" alignItems="center">
          <Button
            size="$3"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            borderRadius="$md"
            onPress={onToggleIndividual}
            icon={run.showIndividual ? <EyeOff size={16} /> : <Eye size={16} />}
            disabled={!hasIndividuals}
            opacity={hasIndividuals ? 1 : 0.5}
          >
            {run.showIndividual ? "Hide Individual" : "Show Individual"}
          </Button>
          <Button size="$3" backgroundColor="$color" color="$background" borderRadius="$md" onPress={onCompare}>
            Compare
          </Button>
        </XStack>
      </XStack>

      <ProgressBar
        complete={run.counts.complete}
        total={run.counts.total}
        failed={run.counts.failed}
        cancelled={run.counts.cancelled}
      />

      <AggregatedCard
        text={run.aggregated?.text}
        isLoading={run.status === "running"}
        confidence={run.aggregated?.confidence}
        onCopy={onCopyAggregated}
        onRetryAll={onRetryAll}
        onBranch={onBranchAggregated}
        onThumbUp={() => setAggregatedReaction((current) => toggleReaction(current, "up"))}
        onThumbDown={() => setAggregatedReaction((current) => toggleReaction(current, "down"))}
        onReadAloud={() => handleReadAloud("aggregated", run.aggregated?.text)}
        reaction={aggregatedReaction}
        isReading={readingTarget === "aggregated"}
        canReadAloud={canReadAloud}
      />

      {run.showIndividual && hasIndividuals && (
        <YStack gap="$sm" marginTop="$xs">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={14} fontWeight="600" color="$color">
              Individual Responses
            </Text>
            <Text fontSize={12} color="$textMuted">
              {results.length} model{results.length !== 1 ? "s" : ""}
            </Text>
          </XStack>

          <XStack flexWrap="wrap" gap="$md">
            {results.map((result) => {
              const isExpanded = expandedCards.has(result.modelId);
              const reaction = modelReactions[result.modelId] ?? null;

              return (
                <ModelAnswerCard
                  key={result.modelId}
                  result={result}
                  modelName={modelNameMap.get(result.modelId) ?? result.modelId}
                  showSteps={showSteps}
                  showCitations={showCitations}
                  isExpanded={isExpanded}
                  onCopy={() => onCopy(result.modelId)}
                  onRetry={() => onRetryModel(result.modelId)}
                  onBranch={() => onBranchModel(result.modelId)}
                  onThumbUp={() =>
                    setModelReactions((prev) => ({
                      ...prev,
                      [result.modelId]: toggleReaction(prev[result.modelId] ?? null, "up"),
                    }))
                  }
                  onThumbDown={() =>
                    setModelReactions((prev) => ({
                      ...prev,
                      [result.modelId]: toggleReaction(prev[result.modelId] ?? null, "down"),
                    }))
                  }
                  onReadAloud={() => handleReadAloud(result.modelId, result.text)}
                  reaction={reaction}
                  isReading={readingTarget === result.modelId}
                  canReadAloud={canReadAloud}
                  onToggleDetails={() => handleToggleCard(result.modelId)}
                />
              );
            })}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
