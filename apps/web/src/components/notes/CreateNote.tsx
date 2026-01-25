"use client";

import { api } from "@packages/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button, Checkbox, H2, Input, Label, Paragraph, Text, TextArea, XStack, YStack } from "tamagui";
import { Plus, X, Check } from "lucide-react";

export default function CreateNote() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isChecked, setIsChecked] = useState(false);

  const createNote = useMutation(api.notes.createNote);
  const openaiKeySet = useQuery(api.openai.openaiKeySet) ?? true;

  const createUserNote = async () => {
    if (!title.trim() || !content.trim()) return;
    await createNote({
      title,
      content,
      isSummary: isChecked,
    });
    setTitle("");
    setContent("");
    setIsChecked(false);
    setOpen(false);
  };

  return (
    <>
      <XStack justifyContent="center">
        <Button
          size="$5"
          backgroundColor="$color"
          color="$background"
          borderRadius="$md"
          onPress={() => setOpen(true)}
          pressStyle={{ opacity: 0.8 }}
          gap="$sm"
        >
          <Plus size={20} color="#fff" />
          <Text color="$background" fontWeight="500">New Note</Text>
        </Button>
      </XStack>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setOpen(false)}
        >
          <YStack
            backgroundColor="$background"
            borderRadius="$lg"
            padding="$lg"
            width="100%"
            maxWidth={500}
            margin="$md"
            gap="$md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <XStack justifyContent="space-between" alignItems="center">
              <H2 fontSize={22} fontWeight="600" color="$color">
                New Note
              </H2>
              <Button
                size="$3"
                circular
                backgroundColor="transparent"
                onPress={() => setOpen(false)}
              >
                <X size={20} color="#666" />
              </Button>
            </XStack>

            <YStack gap="$xs">
              <Label fontSize={14} fontWeight="500" color="$textMuted">
                Title
              </Label>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Note title..."
                backgroundColor="$backgroundSecondary"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                fontSize={16}
              />
            </YStack>

            <YStack gap="$xs">
              <Label fontSize={14} fontWeight="500" color="$textMuted">
                Content
              </Label>
              <TextArea
                value={content}
                onChangeText={setContent}
                placeholder="Write your note..."
                backgroundColor="$backgroundSecondary"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                fontSize={16}
                minHeight={150}
              />
            </YStack>

            <XStack
              alignItems="center"
              gap="$md"
              padding="$md"
              backgroundColor="$backgroundSecondary"
              borderRadius="$md"
              opacity={openaiKeySet ? 1 : 0.5}
            >
              <Checkbox
                size="$4"
                checked={isChecked}
                onCheckedChange={(checked) => openaiKeySet && setIsChecked(checked as boolean)}
                disabled={!openaiKeySet}
                borderColor="$border"
                backgroundColor={isChecked ? "$color" : "transparent"}
              >
                <Checkbox.Indicator>
                  <Check size={14} color="#fff" />
                </Checkbox.Indicator>
              </Checkbox>
              <YStack flex={1}>
                <Text fontSize={15} fontWeight="500" color="$color">
                  AI Summary
                </Text>
                <Paragraph fontSize={13} color="$textMuted">
                  {openaiKeySet ? "Generate an AI summary" : "OpenAI key required"}
                </Paragraph>
              </YStack>
            </XStack>

            <Button
              size="$5"
              backgroundColor="$color"
              color="$background"
              borderRadius="$md"
              onPress={createUserNote}
              pressStyle={{ opacity: 0.8 }}
              marginTop="$sm"
            >
              Create Note
            </Button>
          </YStack>
        </div>
      )}
    </>
  );
}
