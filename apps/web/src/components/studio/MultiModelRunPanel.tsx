import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { MultiModelRun } from "./types";

function formatDuration(startAt: number, endAt?: number) {
  if (!endAt) return "running";
  const durationMs = Math.max(0, endAt - startAt);
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function StatusIcon({
  status,
  hasWarnings,
}: {
  status: MultiModelRun["status"];
  hasWarnings: boolean;
}) {
  if (status === "running") return <Loader2 size={16} color="#9CA3AF" />;
  if (status === "error" || status === "cancelled" || hasWarnings)
    return <AlertTriangle size={16} color="#F97316" />;
  return <CheckCircle2 size={16} color="#22C55E" />;
}

export default function MultiModelRunPanel({
  run,
  onCompare,
  onToggleIndividual,
  onToggleCollapse,
}: {
  run: MultiModelRun;
  onCompare: () => void;
  onToggleIndividual: () => void;
  onToggleCollapse: () => void;
}) {
  const hasWarnings = run.counts.failed > 0 || run.counts.cancelled > 0;
  const title =
    run.status === "running"
      ? "Multi-model analysis running..."
      : hasWarnings
        ? "Multi-model analysis complete (partial)"
        : "Multi-model analysis complete";
  const subtext = `${run.counts.complete}/${run.counts.total} models successful • ${formatDuration(
    run.timings.startAt,
    run.timings.endAt
  )}`;

  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$md"
      backgroundColor="$backgroundSecondary"
      gap="$sm"
    >
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$sm">
        <XStack gap="$sm" alignItems="center">
          <StatusIcon status={run.status} hasWarnings={hasWarnings} />
          <YStack>
            <Text fontSize={14} fontWeight="600" color="$color">
              {title}
            </Text>
            <Text fontSize={12} color="$textMuted">
              {subtext}
            </Text>
          </YStack>
        </XStack>
        <XStack gap="$sm" flexWrap="wrap" justifyContent="flex-end">
          <Button size="$2" backgroundColor="$color" color="$background" borderRadius="$sm" onPress={onCompare}>
            Compare
          </Button>
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            borderRadius="$sm"
            onPress={onToggleIndividual}
          >
            {run.showIndividual ? "Hide Individual" : "Show Individual"}
          </Button>
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            borderRadius="$sm"
            onPress={onToggleCollapse}
          >
            {run.collapsed ? "Expand" : "Collapse"}
          </Button>
        </XStack>
      </XStack>

      <YStack gap="$xs">
        <Text fontSize={12} color="$textMuted">
          Query:
        </Text>
        <Paragraph
          fontSize={13}
          color="$color"
          padding="$sm"
          backgroundColor="$background"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$border"
        >
          {run.queryText}
        </Paragraph>
      </YStack>
    </YStack>
  );
}
