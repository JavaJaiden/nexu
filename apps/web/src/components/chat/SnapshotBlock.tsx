"use client";

import { Text, XStack, YStack } from "tamagui";
import { Bot, Users, User, Clock } from "lucide-react";
import type { ModelSelectionSnapshot } from "./types";
import type { ModelCard } from "@/lib/modelCatalog";
import { getProviderIcon } from "@/lib/modelCatalog";

function ModelBadge({ model }: { model: ModelCard }) {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical="$xs"
      backgroundColor="$background"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
    >
      <Text fontSize={12} color="$textMuted">
        {getProviderIcon(model.provider)}
      </Text>
      <Text fontSize={13} fontWeight="500" color="$color">
        {model.name}
      </Text>
    </XStack>
  );
}

function AutoBadge() {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical="$xs"
      backgroundColor="rgba(34, 197, 94, 0.1)"
      borderRadius="$md"
      borderWidth={1}
      borderColor="rgba(34, 197, 94, 0.3)"
    >
      <Bot size={14} color="#22C55E" />
      <Text fontSize={13} fontWeight="500" color="$success">
        Auto (Nexus routing)
      </Text>
    </XStack>
  );
}

interface SnapshotBlockProps {
  snapshot: ModelSelectionSnapshot;
  modelMetaMap: Map<string, ModelCard>;
  modelNameMap: Map<string, string>;
}

export default function SnapshotBlock({
  snapshot,
  modelMetaMap,
  modelNameMap,
}: SnapshotBlockProps) {
  const isDraft = snapshot.status === "draft";
  const selectedModels = snapshot.selectedModelIds
    .map((id) => modelMetaMap.get(id))
    .filter((m): m is ModelCard => Boolean(m));

  const Icon = snapshot.selectionMode === "multi" ? Users : snapshot.selectionMode === "single" ? User : Bot;

  return (
    <YStack
      gap="$sm"
      padding="$md"
      backgroundColor={isDraft ? "$backgroundSecondary" : "$background"}
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      opacity={isDraft ? 0.8 : 1}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$xs">
          <Icon size={14} color="var(--colorTextMuted)" />
          <Text fontSize={12} fontWeight="600" color="$textMuted">
            {isDraft ? "Next message will use:" : "Used:"}
          </Text>
        </XStack>
        {snapshot.createdAt && (
          <XStack alignItems="center" gap="$xs">
            <Clock size={11} color="var(--colorTextMuted)" />
            <Text fontSize={11} color="$textMuted">
              {new Date(snapshot.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </XStack>
        )}
      </XStack>

      <XStack flexWrap="wrap" gap="$xs">
        {snapshot.selectionMode === "auto" && <AutoBadge />}
        {selectedModels.length > 0 ? (
          selectedModels.map((model) => <ModelBadge key={model.id} model={model} />)
        ) : (
          snapshot.selectedModelIds.map((id) => (
            <XStack
              key={id}
              paddingHorizontal="$sm"
              paddingVertical="$xs"
              backgroundColor="$background"
              borderRadius="$md"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontSize={13} fontWeight="500" color="$color">
                {modelNameMap.get(id) ?? id}
              </Text>
            </XStack>
          ))
        )}
      </XStack>

      {snapshot.selectionMode === "multi" && snapshot.aggregatorModelId && (
        <Text fontSize={12} color="$textMuted">
          Aggregator: {modelNameMap.get(snapshot.aggregatorModelId) ?? snapshot.aggregatorModelId}
        </Text>
      )}
    </YStack>
  );
}
