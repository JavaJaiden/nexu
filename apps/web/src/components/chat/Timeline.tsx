"use client";

import { useMemo } from "react";
import { YStack } from "tamagui";
import type { TimelineProps, ChatEntry, ChatMessage } from "./types";
import MessageBubble from "./MessageBubble";
import RunPanel from "./RunPanel";
import SnapshotBlock from "./SnapshotBlock";

export default function Timeline({
  entries,
  runs,
  toolOverrides,
  toolOverridesByIndex,
  showSteps,
  showCitations,
  collapseAll,
  modelMetaMap,
  modelNameMap,
  onCompareRun,
  onToggleRunIndividual,
  onCopyModel,
  onCopyAggregated,
  onRetryModel,
  onRetryAll,
  onBranchModel,
  onBranchAggregated,
}: TimelineProps) {
  // Build a map of finalized snapshots by message ID
  const finalizedSnapshotsByMessage = useMemo(() => {
    const map = new Map<string, typeof entries[0] & { kind: "snapshot" }>();
    entries.forEach((entry) => {
      if (entry.kind === "snapshot" && entry.snapshot.status === "final") {
        const appliesTo = entry.snapshot.appliesToMessageId;
        if (appliesTo) {
          map.set(appliesTo, entry);
        }
      }
    });
    return map;
  }, [entries]);

  const messageIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((entry) => {
      if (entry.kind === "message") {
        ids.add(entry.message.id);
      }
    });
    return ids;
  }, [entries]);

  // Group entries by their logical flow
  const groupedEntries = useMemo(() => {
    const groups: Array<{
      type: "message" | "run" | "snapshot";
      entry: ChatEntry;
      index: number;
    }> = [];

    entries.forEach((entry, index) => {
      groups.push({
        type: entry.kind,
        entry,
        index,
      });
    });

    return groups;
  }, [entries]);

  let messageIndex = -1;

  return (
    <YStack gap="$lg" width="100%">
      {groupedEntries.map(({ entry }) => {
        // Message entry
        if (entry.kind === "message") {
          messageIndex++;
          const message = entry.message as ChatMessage;
          const isUser = message.role === "user";

          // Get the finalized snapshot for this message if it exists
          const finalizedSnapshot = finalizedSnapshotsByMessage.get(message.id);

          return (
            <YStack key={message.id} gap="$sm" width="100%">
              {finalizedSnapshot && (
                <SnapshotBlock
                  snapshot={finalizedSnapshot.snapshot}
                  modelMetaMap={modelMetaMap}
                  modelNameMap={modelNameMap}
                />
              )}
              <MessageBubble
                message={message}
                isUser={isUser}
                toolOverride={toolOverrides?.[message.id] ?? toolOverridesByIndex?.[messageIndex]}
                showSteps={showSteps}
                showCitations={showCitations}
                globalCollapsed={collapseAll}
                modelMetaMap={modelMetaMap}
                modelNameMap={modelNameMap}
              />
            </YStack>
          );
        }

        // Snapshot entry (draft only - finalized are shown with their messages)
        if (entry.kind === "snapshot") {
          // Skip finalized snapshots that apply to messages (already shown above)
          if (
            entry.snapshot.status === "final" &&
            entry.snapshot.appliesToMessageId &&
            messageIds.has(entry.snapshot.appliesToMessageId)
          ) {
            return null;
          }

          return (
            <SnapshotBlock
              key={entry.snapshot.id}
              snapshot={entry.snapshot}
              modelMetaMap={modelMetaMap}
              modelNameMap={modelNameMap}
            />
          );
        }

        // Run entry
        if (entry.kind === "run") {
          const run = runs.find((r) => r.id === entry.runId);
          if (!run) return null;

          return (
            <YStack key={run.id} gap="$sm" width="100%">
              <RunPanel
                run={run}
                modelNameMap={modelNameMap}
                showSteps={showSteps}
                showCitations={showCitations}
                onCompare={() => onCompareRun(run.id)}
                onToggleIndividual={() => onToggleRunIndividual(run.id)}
                onCopy={(modelId) => onCopyModel(run.id, modelId)}
                onCopyAggregated={() => onCopyAggregated(run.id)}
                onRetryModel={(modelId) => onRetryModel(run.id, modelId)}
                onRetryAll={() => onRetryAll(run.id)}
                onBranchModel={(modelId) => onBranchModel(run.id, modelId)}
                onBranchAggregated={() => onBranchAggregated(run.id)}
              />
            </YStack>
          );
        }

        return null;
      })}
    </YStack>
  );
}
