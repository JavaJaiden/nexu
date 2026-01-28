"use client";

import { Text, XStack, YStack } from "tamagui";
import { Bot } from "lucide-react";
import type { ModelCard } from "@/lib/modelCatalog";
import { getCapabilitiesLabel, getProviderIcon } from "@/lib/modelCatalog";
import type { ModelSelectionSnapshot } from "@/lib/historyStore";

function ModelMiniCard({ model }: { model: ModelCard }) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$sm"
      minWidth={180}
      backgroundColor="$background"
      gap="$xs"
    >
      <XStack alignItems="center" gap="$xs">
        <Text fontSize={12} color="$textMuted">
          {getProviderIcon(model.provider)}
        </Text>
        <Text fontSize={13} fontWeight="600" color="$color">
          {model.name}
        </Text>
      </XStack>
      <Text fontSize={11} color="$textMuted">
        {model.provider}
      </Text>
      <Text fontSize={11} color="$textMuted">
        {getCapabilitiesLabel(model)}
      </Text>
    </YStack>
  );
}

function AutoCard() {
  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$sm"
      minWidth={220}
      backgroundColor="$backgroundSecondary"
      gap="$xs"
    >
      <XStack alignItems="center" gap="$xs">
        <Bot size={14} color="#22C55E" />
        <Text fontSize={13} fontWeight="600" color="$color">
          Auto (Nexus routing)
        </Text>
      </XStack>
      <Text fontSize={11} color="$textMuted">
        Balanced routing across Nexus agents.
      </Text>
    </YStack>
  );
}

export default function ModelSelectionSnapshotBlock({
  snapshot,
  modelMetaMap,
  modelNameMap,
}: {
  snapshot: ModelSelectionSnapshot;
  modelMetaMap: Map<string, ModelCard>;
  modelNameMap: Map<string, string>;
}) {
  const selectionMode = snapshot.selectionMode;
  const selectedModels = snapshot.selectedModelIds
    .map((id) => modelMetaMap.get(id))
    .filter((model): model is ModelCard => Boolean(model));
  const label =
    snapshot.status === "draft" ? "Model selection (Next)" : "Model selection";

  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$md"
      backgroundColor="$backgroundSecondary"
      gap="$sm"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={12} fontWeight="600" color="$textMuted">
          {label}
        </Text>
        {snapshot.createdAt && (
          <Text fontSize={11} color="$textMuted">
            {new Date(snapshot.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </XStack>

      <XStack flexWrap="wrap" gap="$sm">
        {selectionMode === "auto" && <AutoCard />}
        {selectionMode !== "auto" &&
          (selectedModels.length > 0
            ? selectedModels.map((model) => (
                <ModelMiniCard key={model.id} model={model} />
              ))
            : snapshot.selectedModelIds.map((id) => (
                <YStack
                  key={id}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$md"
                  padding="$sm"
                  minWidth={180}
                  backgroundColor="$background"
                >
                  <Text fontSize={13} fontWeight="600" color="$color">
                    {modelNameMap.get(id) ?? id}
                  </Text>
                </YStack>
              )))}
      </XStack>

      {selectionMode === "multi" && (
        <Text fontSize={12} color="$textMuted">
          Aggregator:{" "}
          {snapshot.aggregatorModelId
            ? modelNameMap.get(snapshot.aggregatorModelId) ?? snapshot.aggregatorModelId
            : "Auto (Nexus routing)"}
        </Text>
      )}
    </YStack>
  );
}
