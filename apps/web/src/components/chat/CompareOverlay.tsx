"use client";

import { useState, useMemo, useEffect } from "react";
import { Text, XStack, YStack, Button } from "tamagui";
import { X, Copy, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { MultiModelRun, ModelResult } from "./types";

interface CompareOverlayProps {
  open: boolean;
  run: MultiModelRun | null;
  modelNameMap: Map<string, string>;
  onClose: () => void;
  initialSelected?: string[];
}

function StatusIcon({ status }: { status: ModelResult["status"] }) {
  if (status === "running") return <Loader2 size={16} color="#9CA3AF" className="spin" />;
  if (status === "error" || status === "cancelled") return <AlertTriangle size={16} color="#F97316" />;
  return <CheckCircle2 size={16} color="#22C55E" />;
}

export default function CompareOverlay({
  open,
  run,
  modelNameMap,
  onClose,
  initialSelected = [],
}: CompareOverlayProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(initialSelected);
  const [showAggregated, setShowAggregated] = useState(false);

  const results = useMemo(() => {
    if (!run) return [];
    return run.selectedModels
      .map((id) => run.resultsByModel[id])
      .filter((r): r is ModelResult => Boolean(r));
  }, [run]);

  const completedResults = useMemo(
    () => results.filter((r) => r.status === "complete"),
    [results]
  );

  // Reset selection when overlay opens
  useEffect(() => {
    if (open && run) {
      const completed = results.filter((r) => r.status === "complete").map((r) => r.modelId);
      if (initialSelected.length > 0) {
        setSelectedModels(initialSelected);
      } else if (completed.length <= 3) {
        setSelectedModels(completed);
      } else {
        setSelectedModels(completed.slice(0, 3));
      }
    }
  }, [open, run?.id, initialSelected.join(",")]);

  if (!open || !run) return null;

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const copyAll = async () => {
    const content = selectedModels
      .map((id) => {
        const result = run.resultsByModel[id];
        const name = modelNameMap.get(id) ?? id;
        return `## ${name}\n\n${result?.text ?? ""}`;
      })
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(content);
  };

  const selectedResults = selectedModels
    .map((id) => run.resultsByModel[id])
    .filter((r): r is ModelResult => Boolean(r));

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <YStack
        flex={1}
        backgroundColor="$background"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        overflow="hidden"
      >
        {/* Header */}
        <XStack
          padding="$lg"
          borderBottomWidth={1}
          borderColor="$border"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text fontSize={18} fontWeight="700" color="$color">
            Compare Model Responses
          </Text>
          <XStack gap="$sm" alignItems="center">
            {run.aggregated?.text && (
              <Button
                size="$3"
                backgroundColor={showAggregated ? "$color" : "transparent"}
                color={showAggregated ? "$background" : "$color"}
                borderWidth={1}
                borderColor="$border"
                onPress={() => setShowAggregated(!showAggregated)}
              >
                {showAggregated ? "Hide Summary" : "Show Summary"}
              </Button>
            )}
            <Button
              size="$3"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              color="$color"
              onPress={copyAll}
              icon={<Copy size={16} />}
            >
              Copy Selected
            </Button>
            <Button
              size="$3"
              backgroundColor="transparent"
              borderWidth={0}
              color="$color"
              onPress={onClose}
              icon={<X size={20} />}
            />
          </XStack>
        </XStack>

        {/* Model Selector */}
        <XStack
          padding="$md"
          borderBottomWidth={1}
          borderColor="$border"
          gap="$xs"
          flexWrap="wrap"
        >
          {run.selectedModels.map((modelId) => {
            const result = run.resultsByModel[modelId];
            const isSelected = selectedModels.includes(modelId);
            return (
              <Button
                key={modelId}
                size="$3"
                backgroundColor={isSelected ? "$color" : "transparent"}
                color={isSelected ? "$background" : "$color"}
                borderWidth={1}
                borderColor={isSelected ? "$color" : "$border"}
                borderRadius="$full"
                onPress={() => toggleModel(modelId)}
                disabled={result?.status !== "complete"}
                opacity={result?.status === "complete" ? 1 : 0.5}
              >
                <XStack alignItems="center" gap="$xs">
                  {result && <StatusIcon status={result.status} />}
                  <Text fontSize={13}>
                    {modelNameMap.get(modelId) ?? modelId}
                  </Text>
                </XStack>
              </Button>
            );
          })}
        </XStack>

        {/* Content */}
        <YStack flex={1} overflow="scroll" padding="$lg">
          {showAggregated && run.aggregated?.text ? (
            <YStack
              marginBottom="$lg"
              padding="$lg"
              backgroundColor="rgba(34, 197, 94, 0.08)"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="rgba(34, 197, 94, 0.3)"
            >
              <Text fontSize={14} fontWeight="600" color="$success" marginBottom="$sm">
                Aggregated Response
              </Text>
              <Text fontSize={15} color="$color" lineHeight={1.6}>
                {run.aggregated.text}
              </Text>
            </YStack>
          ) : null}

          <XStack gap="$md" flexWrap="nowrap">
            {selectedResults.map((result) => (
              <YStack
                key={result.modelId}
                minWidth={320}
                flex={1}
                padding="$lg"
                backgroundColor="$backgroundSecondary"
                borderRadius="$lg"
                borderWidth={1}
                borderColor="$border"
                gap="$md"
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$sm">
                    <StatusIcon status={result.status} />
                    <Text fontSize={15} fontWeight="600" color="$color">
                      {modelNameMap.get(result.modelId) ?? result.modelId}
                    </Text>
                  </XStack>
                  <Button
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor="$border"
                    onPress={() => {
                      navigator.clipboard.writeText(result.text ?? "");
                    }}
                    icon={<Copy size={14} />}
                  />
                </XStack>
                <Text fontSize={14} color="$color" lineHeight={1.7} whiteSpace="pre-wrap">
                  {result.text ?? result.errorMessage ?? "No response"}
                </Text>
              </YStack>
            ))}
          </XStack>

          {selectedResults.length === 0 && (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Text fontSize={16} color="$textMuted">
                Select models to compare their responses
              </Text>
            </YStack>
          )}
        </YStack>
      </YStack>
    </div>
  );
}
