"use client";

import type { ModelSelectionSnapshot } from "@/lib/historyStore";
import type { ModelCard } from "@/lib/modelCatalog";
import ModelSelectionSnapshotBlock from "@/components/studio/ModelSelectionSnapshotBlock";

export default function CurrentSelectionPanel({
  selectionMode,
  selectedModelIds,
  aggregatorModelId,
  modelMetaMap,
  modelNameMap,
}: {
  selectionMode: ModelSelectionSnapshot["selectionMode"];
  selectedModelIds: string[];
  aggregatorModelId?: string;
  modelMetaMap: Map<string, ModelCard>;
  modelNameMap: Map<string, string>;
}) {
  const snapshot: ModelSelectionSnapshot = {
    id: "current-selection",
    type: "model_selection_snapshot",
    createdAt: "",
    status: "final",
    selectionMode,
    selectedModelIds,
    aggregatorModelId,
    label: "Current selection",
    pinned: true,
    appliesTo: "next_message",
  };

  return (
    <ModelSelectionSnapshotBlock
      snapshot={snapshot}
      modelMetaMap={modelMetaMap}
      modelNameMap={modelNameMap}
    />
  );
}
