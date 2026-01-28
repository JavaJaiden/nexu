import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { Copy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MultiModelRun } from "./types";

type CompareOverlayProps = {
  open: boolean;
  run: MultiModelRun | null;
  modelNameMap: Map<string, string>;
  onClose: () => void;
  initialSelected?: string[];
};

function formatStatus(status: string) {
  return status === "complete" ? "Complete" : status;
}

export default function CompareOverlay({
  open,
  run,
  modelNameMap,
  onClose,
  initialSelected,
}: CompareOverlayProps) {
  const [showSummary, setShowSummary] = useState(false);
  const results = useMemo(() => {
    if (!run) return [];
    return run.selectedModels.map((modelId) => run.resultsByModel[modelId]).filter(Boolean);
  }, [run]);

  const defaultSelected = useMemo(() => {
    if (!run) return [];
    const completed = results.filter((result) => result.status === "complete").map((result) => result.modelId);
    if (initialSelected && initialSelected.length > 0) {
      return initialSelected;
    }
    if (completed.length <= 3) return completed;
    return completed.slice(0, 3);
  }, [initialSelected, results, run]);

  const [selectedModels, setSelectedModels] = useState<string[]>(defaultSelected);

  useEffect(() => {
    setSelectedModels(defaultSelected);
  }, [defaultSelected, open, run?.id]);

  if (!open || !run) return null;

  const toggleSelection = (modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) return prev.filter((id) => id !== modelId);
      return [...prev, modelId];
    });
  };

  const copyAll = async () => {
    const content = selectedModels
      .map((modelId) => {
        const result = run.resultsByModel[modelId];
        const text = result?.text ?? "";
        return `## ${modelNameMap.get(modelId) ?? modelId}\n${text}`;
      })
      .join("\n\n");
    await navigator.clipboard.writeText(content);
  };

  const selectedResults = selectedModels
    .map((modelId) => run.resultsByModel[modelId])
    .filter(Boolean);

  return (
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200}
      backgroundColor="rgba(6, 7, 9, 0.92)"
      padding="$xl"
    >
      <YStack
        flex={1}
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        padding="$lg"
        backgroundColor="$background"
        gap="$md"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={18} fontWeight="700" color="$color">
            Compare Responses Side-by-Side
          </Text>
          <XStack gap="$sm" alignItems="center">
            <Button
              size="$2"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              color="$color"
              borderRadius="$sm"
              onPress={() => setShowSummary((prev) => !prev)}
            >
              {showSummary ? "Back to columns" : "Summary"}
            </Button>
            <Button
              size="$2"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              color="$color"
              borderRadius="$sm"
              onPress={copyAll}
            >
              <Copy size={14} color="#111" /> Copy All
            </Button>
            <Button size="$2" backgroundColor="transparent" onPress={onClose}>
              <X size={16} color="#111" />
            </Button>
          </XStack>
        </XStack>

        <YStack gap="$sm">
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$sm">
            <XStack gap="$xs" flexWrap="wrap">
              {run.selectedModels.map((modelId) => (
                <Button
                  key={modelId}
                  size="$2"
                  borderWidth={1}
                  borderColor="$border"
                  backgroundColor={selectedModels.includes(modelId) ? "$color" : "transparent"}
                  color={selectedModels.includes(modelId) ? "$background" : "$color"}
                  borderRadius="$full"
                  onPress={() => toggleSelection(modelId)}
                >
                  {modelNameMap.get(modelId) ?? modelId}
                </Button>
              ))}
            </XStack>
            <XStack gap="$sm">
              <Text fontSize={12} color="$textMuted">
                {selectedModels.length} Selected
              </Text>
              <Text fontSize={12} color="$textMuted">
                {run.counts.complete} Complete
              </Text>
            </XStack>
          </XStack>
        </YStack>

        {showSummary ? (
          <YStack
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            padding="$md"
            backgroundColor="$backgroundSecondary"
          >
            <Text fontSize={14} fontWeight="600" color="$color" marginBottom="$xs">
              Aggregated Response
            </Text>
            <Paragraph fontSize={14} color="$color">
              {run.aggregated?.text ?? "No aggregated response yet."}
            </Paragraph>
          </YStack>
        ) : (
          <XStack gap="$md" flex={1} overflow="scroll">
            {selectedResults.map((result) => (
              <YStack
                key={`compare-col-${result.modelId}`}
                minWidth={320}
                flex={1}
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$md"
                backgroundColor="$backgroundSecondary"
                gap="$sm"
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={14} fontWeight="600" color="$color">
                    {modelNameMap.get(result.modelId) ?? result.modelId}
                  </Text>
                  <XStack gap="$xs" alignItems="center">
                    <Text fontSize={11} color="$textMuted">
                      {formatStatus(result.status)}
                    </Text>
                    <Button
                      size="$2"
                      backgroundColor="transparent"
                      borderWidth={1}
                      borderColor="$border"
                      onPress={() => {
                        const text = result.text ?? "";
                        navigator.clipboard.writeText(text);
                      }}
                    >
                      <Copy size={14} color="#111" />
                    </Button>
                  </XStack>
                </XStack>
                <Paragraph fontSize={13} color="$color">
                  {result.text ?? result.errorMessage ?? ""}
                </Paragraph>
              </YStack>
            ))}
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}
