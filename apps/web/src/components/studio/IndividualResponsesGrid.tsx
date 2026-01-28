import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { useState } from "react";
import { CheckCircle2, Copy, Maximize2, AlertTriangle, Loader2 } from "lucide-react";
import type { ModelResult } from "./types";
import type { ModelCard } from "@/lib/modelCatalog";
import { getCapabilitiesLabel, getProviderIcon } from "@/lib/modelCatalog";

function formatLatency(ms?: number) {
  if (!Number.isFinite(ms)) return "—";
  if ((ms as number) < 1000) return `${Math.round(ms as number)} ms`;
  return `${((ms as number) / 1000).toFixed(1)} s`;
}

function StatusIcon({ status }: { status: ModelResult["status"] }) {
  if (status === "running") return <Loader2 size={14} color="#9CA3AF" />;
  if (status === "error" || status === "cancelled") return <AlertTriangle size={14} color="#F97316" />;
  return <CheckCircle2 size={14} color="#22C55E" />;
}

function ModelResponseCard({
  result,
  modelName,
  modelMeta,
  onCopy,
  onExpand,
}: {
  result: ModelResult;
  modelName: string;
  modelMeta?: ModelCard;
  onCopy: () => void;
  onExpand: () => void;
}) {
  const hasError = result.status === "error" || result.status === "cancelled";
  const [expanded, setExpanded] = useState(false);
  const providerLabel = modelMeta?.provider ?? "";
  const providerIcon = providerLabel ? getProviderIcon(providerLabel) : "";
  const capabilities = modelMeta ? getCapabilitiesLabel(modelMeta) : "";
  return (
    <YStack
      flex={1}
      minWidth={280}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$md"
      backgroundColor="$background"
      gap="$sm"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <YStack gap={2}>
          <XStack alignItems="center" gap="$xs">
            <Text fontSize={14} fontWeight="600" color="$color">
              {providerIcon}
            </Text>
            <Text fontSize={14} fontWeight="600" color="$color">
              {modelName}
            </Text>
          </XStack>
          {providerLabel && (
            <Text fontSize={11} color="$textMuted">
              {providerLabel}
            </Text>
          )}
          {capabilities && (
            <Text fontSize={11} color="$textMuted">
              {capabilities}
            </Text>
          )}
          <XStack gap="$xs" alignItems="center">
            <StatusIcon status={result.status} />
            <Text fontSize={11} color="$textMuted">
              {result.status === "complete" ? "Complete" : result.status}
            </Text>
            <Text fontSize={11} color="$textMuted">
              {formatLatency(result.latencyMs)}
            </Text>
          </XStack>
        </YStack>
        <XStack gap="$xs">
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            onPress={onCopy}
          >
            <Copy size={14} color="currentColor" />
          </Button>
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            onPress={onExpand}
          >
            <Maximize2 size={14} color="currentColor" />
          </Button>
        </XStack>
      </XStack>

      {hasError ? (
        <Text fontSize={12} color="$textMuted">
          {result.errorMessage ?? "Model failed to respond."}
        </Text>
      ) : (
        <Paragraph
          fontSize={13}
          color="$color"
          numberOfLines={expanded ? undefined : 8}
          onPress={() => setExpanded((prev) => !prev)}
        >
          {result.text ?? ""}
        </Paragraph>
      )}
    </YStack>
  );
}

export default function IndividualResponsesGrid({
  results,
  modelNameMap,
  modelMetaMap,
  onCopy,
  onExpand,
}: {
  results: ModelResult[];
  modelNameMap: Map<string, string>;
  modelMetaMap: Map<string, ModelCard>;
  onCopy: (modelId: string) => void;
  onExpand: (modelId: string) => void;
}) {
  return (
    <YStack gap="$sm">
      <Text fontSize={14} fontWeight="600" color="$color">
        Individual Model Responses
      </Text>
      <XStack gap="$lg" flexWrap="wrap">
        {results.map((result) => (
          <ModelResponseCard
            key={`model-card-${result.modelId}`}
            result={result}
            modelName={modelNameMap.get(result.modelId) ?? result.modelId}
            modelMeta={modelMetaMap.get(result.modelId)}
            onCopy={() => onCopy(result.modelId)}
            onExpand={() => onExpand(result.modelId)}
          />
        ))}
      </XStack>
    </YStack>
  );
}
