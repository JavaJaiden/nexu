import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type { MultiModelRun } from "./types";

export default function AggregatedResponseCard({
  run,
  onToggleCollapse,
}: {
  run: MultiModelRun;
  onToggleCollapse: () => void;
}) {
  const text = run.aggregated?.text ?? "";
  const lines = text.split("\n").filter(Boolean);
  const finalLine = lines.length > 1 ? lines[lines.length - 1] : null;
  const body = finalLine ? lines.slice(0, -1).join("\n") : text;
  const completedModels = run.counts.complete + run.counts.failed + run.counts.cancelled;
  const aggregatedComplete = run.aggregated?.text || run.status !== "running" ? 1 : 0;
  const totalSteps = Math.max(1, run.counts.total + 1);
  const progress = Math.min(1, (completedModels + aggregatedComplete) / totalSteps);
  const progressPct = Math.round(progress * 100);
  const cardBg = "#e8f7ef";
  const cardText = "#0a3d2a";
  const trackBg = "#d9efe4";
  const trackBorder = "#bcdcca";
  const aggregationLabel = run.aggregated?.text
    ? "Aggregated"
    : run.status === "running"
      ? "Aggregating"
      : "Complete";

  return (
    <YStack
      borderWidth={1}
      borderColor="$success"
      borderRadius="$md"
      padding="$md"
      backgroundColor={cardBg}
      gap="$sm"
    >
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$sm">
        <Text fontSize={14} fontWeight="600" color={cardText}>
          Aggregated Response
        </Text>
        <Button
          size="$2"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$success"
          color={cardText}
          borderRadius="$sm"
          onPress={onToggleCollapse}
        >
          {run.collapsed ? "Expand" : "Collapse"}
        </Button>
      </XStack>
      <YStack gap="$xs">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={11} color={cardText}>
            Progress
          </Text>
          <XStack alignItems="center" gap="$xs">
            <Text fontSize={11} color={cardText}>
              {completedModels}/{run.counts.total} models
            </Text>
            <Text fontSize={11} color={cardText}>
              {aggregationLabel}
            </Text>
          </XStack>
        </XStack>
        <YStack
          height={8}
          borderRadius="$full"
          backgroundColor={trackBg}
          borderWidth={1}
          borderColor={trackBorder}
          overflow="hidden"
        >
          <YStack height="100%" width={`${progressPct}%`} backgroundColor="$success" />
        </YStack>
        <Text fontSize={11} color={cardText}>
          {progressPct}% complete
        </Text>
      </YStack>
      {run.aggregated?.text ? null : (
        <Paragraph fontSize={14} color={cardText}>
          Aggregating responses from the selected models...
        </Paragraph>
      )}
      {body && (
        <Paragraph fontSize={14} color={cardText}>
          {body}
        </Paragraph>
      )}
      {finalLine && (
        <YStack
          padding="$sm"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$sm"
          backgroundColor="$backgroundSecondary"
        >
          <Text fontSize={13} color="$textMuted">
            Final answer
          </Text>
          <Text fontSize={16} fontWeight="600" color="$color">
            {finalLine}
          </Text>
        </YStack>
      )}
    </YStack>
  );
}
