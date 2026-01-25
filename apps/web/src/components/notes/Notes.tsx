"use client";

import { api } from "@packages/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { Search, Plus, Trash2 } from "lucide-react";
import CreateNote from "./CreateNote";

const Notes = () => {
  const [search, setSearch] = useState("");

  const allNotes = useQuery(api.notes.getNotes);
  const deleteNote = useMutation(api.notes.deleteNote);

  const finalNotes = search
    ? allNotes?.filter(
        (note) =>
          note.title.toLowerCase().includes(search.toLowerCase()) ||
          note.content.toLowerCase().includes(search.toLowerCase())
      )
    : allNotes;

  return (
    <YStack flex={1} backgroundColor="$background" padding="$lg" maxWidth={800} marginHorizontal="auto" width="100%">
      <H1 fontSize={28} fontWeight="600" color="$color" textAlign="center" marginBottom="$lg">
        Your Notes
      </H1>

      {/* Search */}
      <XStack
        alignItems="center"
        gap="$sm"
        paddingHorizontal="$md"
        paddingVertical="$sm"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        marginBottom="$lg"
        backgroundColor="$background"
      >
        <Search size={18} color="#999" />
        <Input
          flex={1}
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes..."
          backgroundColor="transparent"
          borderWidth={0}
          fontSize={16}
          color="$color"
          padding={0}
        />
      </XStack>

      {/* Notes List */}
      <YStack borderWidth={1} borderColor="$border" borderRadius="$md" marginBottom="$lg">
        {!finalNotes || finalNotes.length === 0 ? (
          <YStack padding="$xl" alignItems="center">
            <Paragraph color="$textMuted">No notes yet</Paragraph>
          </YStack>
        ) : (
          finalNotes.map((note, index) => (
            <XStack
              key={note._id}
              borderBottomWidth={index < finalNotes.length - 1 ? 1 : 0}
              borderBottomColor="$border"
              padding="$md"
              alignItems="center"
              justifyContent="space-between"
              hoverStyle={{ backgroundColor: "$backgroundSecondary" }}
            >
              <Link href={`/notes/${note._id}`} style={{ flex: 1, textDecoration: "none" }}>
                <YStack flex={1}>
                  <Text fontSize={16} fontWeight="500" color="$color">
                    {note.title}
                  </Text>
                  <Paragraph fontSize={14} color="$textMuted" numberOfLines={1}>
                    {note.content}
                  </Paragraph>
                </YStack>
              </Link>
              <Button
                size="$3"
                backgroundColor="transparent"
                borderWidth={0}
                onPress={() => deleteNote({ noteId: note._id })}
                hoverStyle={{ backgroundColor: "$backgroundSecondary" }}
              >
                <Trash2 size={18} color="#999" />
              </Button>
            </XStack>
          ))
        )}
      </YStack>

      <CreateNote />
    </YStack>
  );
};

export default Notes;
