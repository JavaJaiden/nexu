import { ArrowLeft, Check } from "@tamagui/lucide-icons";
import { api } from "@packages/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import {
  Button,
  Checkbox,
  H2,
  Input,
  Label,
  Paragraph,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
} from "tamagui";

export default function CreateNoteScreen({
  navigation,
}: {
  navigation: any;
}) {
  const createNote = useMutation(api.notes.createNote);
  const openaiKeySet = useQuery(api.openai.openaiKeySet) ?? true;

  const [isAdvancedSummarizationEnabled, setIsAdvancedSummarizationEnabled] =
    useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createUserNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert("Missing Title", "Please enter a title");
      return;
    }
    if (!noteContent.trim()) {
      Alert.alert("Missing Content", "Please enter content");
      return;
    }

    setIsCreating(true);

    try {
      await createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        isSummary: isAdvancedSummarizationEnabled,
      });
      navigation.navigate("NotesDashboardScreen");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create note");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingHorizontal="$md"
        paddingVertical="$md"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Button
          size="$3"
          circular
          backgroundColor="transparent"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="$color" />
        </Button>
        <H2 fontSize={17} fontWeight="600" color="$color">
          New Note
        </H2>
        <YStack width={40} />
      </XStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <YStack padding="$lg" gap="$lg">
            {/* Title */}
            <YStack gap="$xs">
              <Label fontSize={13} fontWeight="500" color="$textMuted">
                Title
              </Label>
              <Input
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="Note title..."
                placeholderTextColor="$textSubtle"
                backgroundColor="$backgroundSecondary"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$md"
                fontSize={16}
                color="$color"
              />
            </YStack>

            {/* Content */}
            <YStack gap="$xs">
              <Label fontSize={13} fontWeight="500" color="$textMuted">
                Content
              </Label>
              <TextArea
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write your note..."
                placeholderTextColor="$textSubtle"
                backgroundColor="$backgroundSecondary"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$md"
                fontSize={16}
                color="$color"
                minHeight={180}
                textAlignVertical="top"
              />
            </YStack>

            {/* AI Option */}
            <XStack
              alignItems="center"
              gap="$md"
              padding="$md"
              backgroundColor="$backgroundSecondary"
              borderRadius="$md"
              borderWidth={1}
              borderColor="$border"
              opacity={openaiKeySet ? 1 : 0.5}
              onPress={() =>
                openaiKeySet &&
                setIsAdvancedSummarizationEnabled(!isAdvancedSummarizationEnabled)
              }
            >
              <Checkbox
                size="$4"
                checked={isAdvancedSummarizationEnabled}
                onCheckedChange={(checked) =>
                  openaiKeySet && setIsAdvancedSummarizationEnabled(checked as boolean)
                }
                disabled={!openaiKeySet}
                borderColor="$border"
                backgroundColor={
                  isAdvancedSummarizationEnabled ? "$color" : "transparent"
                }
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
                  {openaiKeySet
                    ? "Generate an AI summary"
                    : "OpenAI key required"}
                </Paragraph>
              </YStack>
            </XStack>
          </YStack>
        </ScrollView>

        {/* Create Button */}
        <YStack
          position="absolute"
          bottom={30}
          left={24}
          right={24}
        >
          <Button
            size="$5"
            backgroundColor="$color"
            color="$background"
            borderRadius="$md"
            onPress={createUserNote}
            disabled={isCreating}
            pressStyle={{ opacity: 0.8 }}
          >
            {isCreating ? (
              <Spinner size="small" color="$background" />
            ) : (
              "Create Note"
            )}
          </Button>
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  );
}
