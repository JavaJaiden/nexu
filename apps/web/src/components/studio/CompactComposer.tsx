"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Text, TextArea, XStack, YStack } from "tamagui";
import { Plus, Send, X, Mic, MicOff } from "lucide-react";
import ComposerActionMenu from "@/components/studio/ComposerActionMenu";
import type { PdfAttachment } from "@/lib/externalContext";
import { useSpeechDictation } from "@/lib/useSpeechDictation";

type CompactComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isBusy: boolean;
  attachments: PdfAttachment[];
  onRemoveAttachment: (index: number) => void;
  onFilesSelected: (files: FileList | null) => void;
  showCitations: boolean;
  showSteps: boolean;
  mode: "fast" | "deep";
  onToggleCitations: () => void;
  onToggleSteps: () => void;
  onModeChange: (mode: "fast" | "deep") => void;
  stackCount: number;
  isDefaultStack: boolean;
};

const MAX_HEIGHT = 140;

export default function CompactComposer({
  value,
  onChange,
  onSend,
  onStop,
  isBusy,
  attachments,
  onRemoveAttachment,
  onFilesSelected,
  showCitations,
  showSteps,
  mode,
  onToggleCitations,
  onToggleSteps,
  onModeChange,
  stackCount,
  isDefaultStack,
}: CompactComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<any>(null);
  const valueRef = useRef(value);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonRef = useRef<any>(null);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
  }, [value]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const appendDictationText = useCallback(
    (spokenText: string) => {
      const current = valueRef.current ?? "";
      const separator = current.trim().length === 0 || /\s$/.test(current) ? "" : " ";
      onChange(`${current}${separator}${spokenText}`);
    },
    [onChange]
  );

  const {
    isSupported: supportsDictation,
    isListening: isDictating,
    toggle: toggleDictation,
    stop: stopDictation,
  } = useSpeechDictation({ onText: appendDictationText });

  useEffect(() => {
    if (!isBusy && !isDictating) return;
    if (!isBusy) return;
    stopDictation();
  }, [isBusy, isDictating, stopDictation]);

  const handleSendPress = useCallback(() => {
    if (isDictating) {
      stopDictation();
    }
    onSend();
  }, [isDictating, stopDictation, onSend]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (actionButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  return (
    <YStack gap="$xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.currentTarget.value = "";
        }}
        style={{ display: "none" }}
      />
      <XStack alignItems="flex-end" gap="$sm">
        <YStack position="relative">
          <Button
            ref={actionButtonRef}
            size="$3"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            borderRadius="$full"
            onPress={() => setMenuOpen((prev) => !prev)}
            icon={<Plus size={16} color="currentColor" />}
            hoverStyle={{ borderColor: "$color" }}
          />
          <ComposerActionMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onUpload={() => fileInputRef.current?.click()}
            showCitations={showCitations}
            showSteps={showSteps}
            mode={mode}
            onToggleCitations={onToggleCitations}
            onToggleSteps={onToggleSteps}
            onModeChange={onModeChange}
            menuRef={menuRef}
          />
        </YStack>

        <Button
          size="$3"
          backgroundColor={isDictating ? "$backgroundSecondary" : "transparent"}
          borderWidth={1}
          borderColor="$border"
          color={isDictating ? "$color" : "$textMuted"}
          borderRadius="$full"
          onPress={toggleDictation}
          disabled={isBusy || !supportsDictation}
          opacity={isBusy || !supportsDictation ? 0.5 : 1}
          icon={isDictating ? <MicOff size={16} color="currentColor" /> : <Mic size={16} color="currentColor" />}
          hoverStyle={{ borderColor: "$color" }}
        />

        <YStack flex={1}>
          <TextArea
            ref={textAreaRef}
            value={value}
            onChangeText={onChange}
            placeholder="Ask a homework question..."
            minHeight={44}
            maxHeight={MAX_HEIGHT}
            borderColor="$border"
            backgroundColor="$background"
            fontSize={14}
            padding="$sm"
            
            style={{ resize: "none", overflow: "auto" } as any}
          />
          {attachments.length > 0 && (
            <XStack flexWrap="wrap" gap="$xs" marginTop="$xs">
              {attachments.map((attachment, index) => (
                <XStack
                  key={`${attachment.name}-${index}`}
                  alignItems="center"
                  gap="$xs"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$full"
                  paddingHorizontal="$sm"
                  paddingVertical="$xs"
                  backgroundColor="$backgroundSecondary"
                >
                  <Text fontSize={11} color="$textMuted">
                    {attachment.name}
                  </Text>
                  <Button
                    size="$1"
                    backgroundColor="transparent"
                    borderWidth={0}
                    color="$textMuted"
                    onPress={() => onRemoveAttachment(index)}
                  >
                    <X size={12} />
                  </Button>
                </XStack>
              ))}
            </XStack>
          )}
        </YStack>

        <YStack gap="$xs" alignItems="flex-end">
          <Text fontSize={11} color="$textMuted">
            {`Multi-model run • ${stackCount} selected${isDefaultStack ? " (default stack)" : ""}`}
          </Text>
          <Button
            size="$3"
            backgroundColor={isBusy ? "$red10" : "$color"}
            color={isBusy ? "$background" : "$background"}
            borderRadius="$sm"
            icon={isBusy ? <X size={16} color="#fff" /> : <Send size={16} color="#fff" />}
            onPress={isBusy ? onStop : handleSendPress}
          >
            {isBusy ? "Stop" : "Send"}
          </Button>
        </YStack>
      </XStack>
    </YStack>
  );
}
