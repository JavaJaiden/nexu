"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { Send, X, Paperclip, Loader2 } from "lucide-react";
import type { ComposerProps, PdfAttachment } from "./types";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PdfAttachment;
  onRemove: () => void;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical="$xs"
      backgroundColor="$backgroundSecondary"
      borderRadius="$full"
      borderWidth={1}
      borderColor="$border"
    >
      <Text fontSize={11} color="$textMuted" numberOfLines={1} maxWidth={120}>
        {attachment.name}
      </Text>
      <Button
        size="$1"
        backgroundColor="transparent"
        borderWidth={0}
        padding="$xs"
        onPress={onRemove}
        hoverStyle={{ backgroundColor: "$backgroundTertiary" }}
        pressStyle={{ scale: 0.95 }}
      >
        <X size={12} color="var(--colorTextMuted)" />
      </Button>
    </XStack>
  );
}

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isBusy,
  isReadOnly = false,
  attachments,
  onRemoveAttachment,
  onFilesSelected,
  placeholder = "Ask a homework question...",
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    
    el.style.height = "auto";
    const scrollHeight = el.scrollHeight;
    const clampedHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${clampedHeight}px`;
  }, [value]);

  const isDisabled = isBusy || isReadOnly;

  // Focus on mount
  useEffect(() => {
    if (isReadOnly) return;
    textareaRef.current?.focus();
  }, [isReadOnly]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isReadOnly) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isBusy && value.trim()) {
          onSend();
        }
      }
    },
    [isBusy, isReadOnly, value, onSend]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      onFilesSelected(e.target.files);
      e.currentTarget.value = "";
    },
    [isReadOnly, onFilesSelected]
  );

  return (
    <YStack
      gap="$sm"
      padding="$md"
      backgroundColor="$background"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={isFocused ? "$color" : "$border"}

      style={{
        boxShadow: isFocused
          ? "0 0 0 2px var(--colorColorTransparent)"
          : "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Attachments */}
      {attachments.length > 0 && (
        <XStack flexWrap="wrap" gap="$xs">
          {attachments.map((attachment, index) => (
            <AttachmentChip
              key={`${attachment.name}-${index}`}
              attachment={attachment}
              onRemove={() => onRemoveAttachment(index)}
            />
          ))}
        </XStack>
      )}

      {/* Input Area */}
      <XStack alignItems="flex-end" gap="$sm">
        <XStack flex={1} position="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isDisabled}
            style={{
              width: "100%",
              minHeight: MIN_HEIGHT,
              maxHeight: MAX_HEIGHT,
              padding: "12px 16px",
              fontSize: 15,
              lineHeight: 1.5,
              fontFamily: "inherit",
              color: "var(--color)",
              caretColor: "var(--color)",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: 8,
              resize: "none",
              outline: "none",
            }}
          />
        </XStack>

        {/* Actions */}
        <XStack alignItems="center" gap="$xs" paddingBottom="$xs">
          <Button
            size="$3"
            backgroundColor="transparent"
            borderWidth={0}
            color="$textMuted"
            onPress={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            hoverStyle={{ backgroundColor: "$backgroundSecondary" }}
            pressStyle={{ scale: 0.95 }}
            icon={<Paperclip size={18} />}
          />

          {isBusy ? (
            <Button
              size="$3"
              backgroundColor="$red10"
              color="white"
              borderRadius="$md"
              onPress={onStop}
              pressStyle={{ scale: 0.98 }}
              icon={<X size={18} />}
            >
              Stop
            </Button>
          ) : (
            <Button
              size="$3"
              backgroundColor="$color"
              color="$background"
              borderRadius="$md"
              onPress={onSend}
              disabled={isReadOnly || !value.trim()}
              opacity={!isReadOnly && value.trim() ? 1 : 0.5}
              pressStyle={{ scale: 0.98 }}
              icon={<Send size={18} />}
            >
              Send
            </Button>
          )}
        </XStack>
      </XStack>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </YStack>
  );
}
