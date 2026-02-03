"use client";

import { useState, useMemo } from "react";
import { Text, XStack, YStack, Button } from "tamagui";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Maximize2,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { RunPanelProps, ModelResult } from "./types";

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
  const completePct = Math.round((complete / total) * 100);
  const failedPct = Math.round((failed / total) * 100);
  const cancelledPct = Math.round((cancelled / total) * 100);

  return (
    <YStack gap="$xs">
      <XStack height={6} borderRadius="$full" overflow="hidden" backgroundColor="$backgroundSecondary">
        <YStack
          height="100%"
          width={`${completePct}%`}
          backgroundColor="$success"
        />
        {failedPct > 0 && (
          <YStack
            height="100%"
            width={`${failedPct}%`}
            backgroundColor="$orange10"
          />
        )}
        {cancelledPct > 0 && (
          <YStack
            height="100%"
            width={`${cancelledPct}%`}
            backgroundColor="$gray8"
          />
        )}
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

function ModelPreviewCard({
  result,
  modelName,
  onExpand,
}: {
  result: ModelResult;
  modelName: string;
  onExpand: () => void;
}) {
  const isError = result.status === "error" || result.status === "cancelled";
  const [isHovered, setIsHovered] = useState(false);

  // Truncate text for preview
  const previewText = result.text 
    ? result.text.slice(0, 120) + (result.text.length > 120 ? "..." : "")
    : "No response";

  return (
    <YStack
      flex={1}
      minWidth={260}
      maxWidth={360}
      padding="$md"
      backgroundColor="$background"
      borderRadius="$lg"
      borderWidth={2}
      borderColor={isError ? "$orange10" : isHovered ? "$color" : "$border"}
      gap="$sm"
      hoverStyle={{
        borderColor: "$color",
        transform: "translateY(-2px)",
        shadowColor: "$color",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        shadowOpacity: 0.1,
      }}
      animation="fast"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      cursor="pointer"
      onPress={onExpand}
    >
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$sm">
          <StatusIcon status={result.status} />
          <Text fontSize={14} fontWeight="600" color="$color">
            {modelName}
          </Text>
        </XStack>
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
      </XStack>

      {/* Preview Content */}
      {result.status === "complete" ? (
        <YStack gap="$xs">
          <Text
            fontSize={13}
            color="$color"
            lineHeight={1.5}
            numberOfLines={3}
          >
            {previewText}
          </Text>
          <Text fontSize={12} color="$textMuted" marginTop="$xs">
            Click to expand →
          </Text>
        </YStack>
      ) : (
        <Text fontSize={13} color="$textMuted">
          {result.errorMessage ?? "Model failed to respond"}
        </Text>
      )}
    </YStack>
  );
}

function ExpandedModelCard({
  result,
  modelName,
  onCopy,
  onCollapse,
}: {
  result: ModelResult;
  modelName: string;
  onCopy: () => void;
  onCollapse: () => void;
}) {
  const isError = result.status === "error" || result.status === "cancelled";

  return (
    <YStack
      flex={1}
      minWidth={280}
      maxWidth={480}
      padding="$lg"
      backgroundColor="$background"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={isError ? "$orange10" : "$border"}
      gap="$md"
    >
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$sm">
          <StatusIcon status={result.status} />
          <Text fontSize={15} fontWeight="600" color="$color">
            {modelName}
          </Text>
        </XStack>
        <XStack gap="$xs">
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            onPress={onCopy}
            icon={<Copy size={14} color="var(--colorTextMuted)" />}
          >
            Copy
          </Button>
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            onPress={onCollapse}
            icon={<ChevronUp size={14} color="var(--colorTextMuted)" />}
          >
            Collapse
          </Button>
        </XStack>
      </XStack>

      {/* Metadata */}
      {result.status === "complete" && (
        <XStack alignItems="center" gap="$xs">
          <Clock size={12} color="var(--colorTextMuted)" />
          <Text fontSize={12} color="$textMuted">
            {formatLatency(result.latencyMs)}
          </Text>
          {result.tokensOut && (
            <>
              <Text fontSize={12} color="$textMuted">•</Text>
              <Text fontSize={12} color="$textMuted">
                {result.tokensOut} tokens
              </Text>
            </>
          )}
        </XStack>
      )}

      {/* Full Content */}
      {result.status === "complete" ? (
        <Text
          fontSize={14}
          color="$color"
          lineHeight={1.6}
          whiteSpace="pre-wrap"
        >
          {result.text}
        </Text>
      ) : (
        <Text fontSize={14} color="$textMuted">
          {result.errorMessage ?? "Model failed to respond"}
        </Text>
      )}
    </YStack>
  );
}

function AggregatedCard({
  text,
  isLoading,
  confidence,
}: {
  text?: string;
  isLoading: boolean;
  confidence?: number;
}) {
  return (
    <YStack
      padding="$lg"
      backgroundColor="rgba(34, 197, 94, 0.08)"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="rgba(34, 197, 94, 0.3)"
      gap="$sm"
    >
      <XStack alignItems="center" gap="$xs">
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
    </YStack>
  );
}

export default function RunPanel({
  run,
  modelNameMap,
  modelMetaMap,
  onCompare,
  onToggleIndividual,
  onCopy,
  onExpand,
}: RunPanelProps) {
  const results = useMemo(
    () => run.selectedModels.map((id) => run.resultsByModel[id]).filter(Boolean),
    [run]
  );

  const hasErrors = run.counts.failed > 0 || run.counts.cancelled > 0;
  
  // Track which cards are expanded
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  return (
    <YStack
      gap="$md"
      padding="$lg"
      backgroundColor="$backgroundSecondary"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={hasErrors ? "$orange10" : "$border"}
    >
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack flex={1} gap="$xs">
          <XStack alignItems="center" gap="$sm">
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
          >
            {run.showIndividual ? "Hide Individual" : "Show Individual"}
          </Button>
          <Button
            size="$3"
            backgroundColor="$color"
            color="$background"
            borderRadius="$md"
            onPress={onCompare}
          >
            Compare
          </Button>
        </XStack>
      </XStack>

      {/* Progress */}
      <ProgressBar
        complete={run.counts.complete}
        total={run.counts.total}
        failed={run.counts.failed}
        cancelled={run.counts.cancelled}
      />

      {/* Aggregated Result - Always shown */}
      <AggregatedCard
        text={run.aggregated?.text}
        isLoading={run.status === "running"}
        confidence={run.aggregated?.confidence}
      />

      {/* Individual Results - Toggleable */}
      {run.showIndividual && (
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
              
              return isExpanded ? (
                <ExpandedModelCard
                  key={result.modelId}
                  result={result}
                  modelName={modelNameMap.get(result.modelId) ?? result.modelId}
                  onCopy={() => onCopy(result.modelId)}
                  onCollapse={() => handleToggleCard(result.modelId)}
                />
              ) : (
                <ModelPreviewCard
                  key={result.modelId}
                  result={result}
                  modelName={modelNameMap.get(result.modelId) ?? result.modelId}
                  onExpand={() => handleToggleCard(result.modelId)}
                />
              );
            })}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
