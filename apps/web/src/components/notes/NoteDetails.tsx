"use client";

import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Button, H1, Paragraph, Text, XStack, YStack } from "tamagui";

interface NoteDetailsProps {
  noteId: Id<"notes">;
}

const NoteDetails = ({ noteId }: NoteDetailsProps) => {
  const [activeTab, setActiveTab] = useState<"original" | "summary">("original");
  const currentNote = useQuery(api.notes.getNote, { id: noteId });

  const hasSummary = !!currentNote?.summary;

  return (
    <YStack flex={1} padding="$lg" maxWidth={800} marginHorizontal="auto" width="100%">
      {/* Tab Switcher */}
      <XStack
        alignSelf="center"
        backgroundColor="$backgroundSecondary"
        borderRadius="$md"
        padding="$xs"
        marginBottom="$lg"
      >
        <Button
          size="$3"
          backgroundColor={activeTab === "original" ? "$background" : "transparent"}
          borderRadius="$sm"
          onPress={() => setActiveTab("original")}
          borderWidth={0}
        >
          <Text
            fontSize={14}
            fontWeight="500"
            color={activeTab === "original" ? "$color" : "$textMuted"}
          >
            Original
          </Text>
        </Button>

        <Button
          size="$3"
          backgroundColor={activeTab === "summary" ? "$background" : "transparent"}
          borderRadius="$sm"
          onPress={() => hasSummary && setActiveTab("summary")}
          opacity={hasSummary ? 1 : 0.4}
          disabled={!hasSummary}
          borderWidth={0}
        >
          <Text
            fontSize={14}
            fontWeight="500"
            color={activeTab === "summary" ? "$color" : "$textMuted"}
          >
            Summary
          </Text>
        </Button>
      </XStack>

      {/* Title */}
      <H1
        fontSize={28}
        fontWeight="600"
        color="$color"
        textAlign="center"
        marginBottom="$lg"
      >
        {currentNote?.title}
      </H1>

      {/* Content */}
      <YStack>
        <Text fontSize={12} color="$textSubtle" marginBottom="$md">
          {activeTab === "original" ? "Original Content" : "AI Summary"}
        </Text>
        <Paragraph fontSize={18} lineHeight={28} color="$color">
          {activeTab === "original"
            ? currentNote?.content
            : currentNote?.summary || "No summary available"}
        </Paragraph>
      </YStack>
    </YStack>
  );
};

export default NoteDetails;
