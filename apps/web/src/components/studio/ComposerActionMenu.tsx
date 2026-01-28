"use client";

import { Button, Text, XStack, YStack } from "tamagui";
import type React from "react";

type ComposerActionMenuProps = {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  showCitations: boolean;
  showSteps: boolean;
  mode: "fast" | "deep";
  onToggleCitations: () => void;
  onToggleSteps: () => void;
  onModeChange: (mode: "fast" | "deep") => void;
  menuRef: React.RefObject<HTMLDivElement>;
};

export default function ComposerActionMenu({
  open,
  onClose,
  onUpload,
  showCitations,
  showSteps,
  mode,
  onToggleCitations,
  onToggleSteps,
  onModeChange,
  menuRef,
}: ComposerActionMenuProps) {
  if (!open) return null;

  return (
    <YStack
      ref={menuRef}
      position="absolute"
      top={44}
      left={0}
      zIndex={30}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$sm"
      backgroundColor="$background"
      gap="$xs"
      minWidth={200}
      shadowColor="rgba(0,0,0,0.2)"
      shadowOpacity={0.25}
      shadowRadius={12}
    >
      <Button
        size="$2"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$border"
        color="$color"
        onPress={() => {
          onUpload();
          onClose();
        }}
      >
        Upload PDF
      </Button>
      <XStack gap="$xs">
        <Button
          size="$2"
          backgroundColor={showCitations ? "$color" : "transparent"}
          color={showCitations ? "$background" : "$color"}
          borderWidth={1}
          borderColor="$border"
          onPress={() => {
            onToggleCitations();
          }}
        >
          Citations
        </Button>
        <Button
          size="$2"
          backgroundColor={showSteps ? "$color" : "transparent"}
          color={showSteps ? "$background" : "$color"}
          borderWidth={1}
          borderColor="$border"
          onPress={() => {
            onToggleSteps();
          }}
        >
          Steps
        </Button>
      </XStack>
      <YStack gap="$xs">
        <Text fontSize={11} color="$textMuted">
          Mode
        </Text>
        <XStack gap="$xs">
          <Button
            size="$2"
            backgroundColor={mode === "fast" ? "$color" : "transparent"}
            color={mode === "fast" ? "$background" : "$color"}
            borderWidth={1}
            borderColor="$border"
            onPress={() => {
              onModeChange("fast");
            }}
          >
            Fast
          </Button>
          <Button
            size="$2"
            backgroundColor={mode === "deep" ? "$color" : "transparent"}
            color={mode === "deep" ? "$background" : "$color"}
            borderWidth={1}
            borderColor="$border"
            onPress={() => {
              onModeChange("deep");
            }}
          >
            Deep
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}
