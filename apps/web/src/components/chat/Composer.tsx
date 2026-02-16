"use client";

import {
  BookText,
  Brain,
  FileText as FileTextIcon,
  ImagePlus,
  ListChecks,
  Mic,
  MicOff,
  Send,
  Settings2,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { useSpeechDictation } from "@/lib/useSpeechDictation";
import type { ComposerProps, PdfAttachment, SuggestionTask } from "./types";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;
const ACTIVE_MENU_BG = "var(--app-accent, #22C55E)";
const ACTIVE_MENU_TEXT = "#0A0A0A";
const FLAT_BUTTON_STYLE = {
  boxShadow: "none",
  filter: "none",
  backgroundImage: "none",
  textShadow: "none",
  backdropFilter: "none",
} as const;

const FLAT_BUTTON_INTERACTION_STYLE = {
  shadowColor: "transparent",
  shadowOpacity: 0,
  shadowRadius: 0,
  boxShadow: "none",
  filter: "none",
  backgroundImage: "none",
} as const;

const TASK_LABELS: Record<SuggestionTask, string> = {
  code: "Code",
  creative: "Creative",
  analysis: "Analysis",
  general: "General",
};

function isFileDragEvent(event: React.DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PdfAttachment;
  onRemove: () => void;
}) {
  const isImage =
    attachment.type.startsWith("image/") ||
    /\.(apng|avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i.test(
      attachment.name
    );
  const previewSrc = useMemo(
    () =>
      isImage
        ? `data:${attachment.type || "application/octet-stream"};base64,${attachment.data}`
        : "",
    [attachment.data, attachment.type, isImage]
  );
  const fileLabel = (attachment.type || "file").split("/")[1] ?? "file";

  return (
    <YStack
      width={148}
      gap="$xs"
      padding="$xs"
      backgroundColor="$backgroundSecondary"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
    >
      <YStack
        height={94}
        backgroundColor="$background"
        borderRadius="$sm"
        borderWidth={1}
        borderColor="$border"
        overflow="hidden"
        position="relative"
      >
        {isImage ? (
          <Image
            src={previewSrc}
            alt={attachment.name}
            fill
            unoptimized
            sizes="148px"
            loading="lazy"
            style={{
              objectFit: "cover",
            }}
          />
        ) : (
          <YStack
            alignItems="center"
            justifyContent="center"
            flex={1}
            gap="$xs"
          >
            <FileTextIcon size={20} color="var(--colorTextMuted)" />
            <Text fontSize={10} color="$textMuted" fontWeight="600">
              {fileLabel.toUpperCase()}
            </Text>
          </YStack>
        )}
        <Button
          size="$1"
          position="absolute"
          top="$xs"
          right="$xs"
          backgroundColor="rgba(0,0,0,0.55)"
          borderWidth={0}
          padding="$xs"
          onPress={onRemove}
          hoverStyle={{ backgroundColor: "rgba(0,0,0,0.68)" }}
          pressStyle={{ scale: 0.95 }}
        >
          <X size={12} color="white" />
        </Button>
      </YStack>
      <Text fontSize={11} color="$color" numberOfLines={1} maxWidth={136}>
        {attachment.name}
      </Text>
      <Text fontSize={10} color="$textMuted" numberOfLines={1}>
        {attachment.type || "file"}
      </Text>
    </YStack>
  );
}

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isBusy,
  isReadOnly = false,
  mode,
  onModeChange,
  showSteps,
  onToggleSteps,
  showCitations,
  onToggleCitations,
  attachments,
  onRemoveAttachment,
  onFilesSelected,
  taskSuggestions,
  onUseSuggestedAggregator,
  onAddSuggestedModelsToStack,
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
  placeholder = "Ask a homework question...",
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRegionRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const dragDepthRef = useRef(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SuggestionTask | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const scrollHeight = value.length === 0 ? MIN_HEIGHT : el.scrollHeight;
    const clampedHeight = Math.min(
      Math.max(scrollHeight, MIN_HEIGHT),
      MAX_HEIGHT
    );
    el.style.height = `${clampedHeight}px`;
  }, [value]);

  const isDisabled = isBusy || isReadOnly;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const appendDictationText = useCallback(
    (spokenText: string) => {
      const current = valueRef.current ?? "";
      const separator =
        current.trim().length === 0 || /\s$/.test(current) ? "" : " ";
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
    if (isReadOnly) return;
    textareaRef.current?.focus();
  }, [isReadOnly]);

  useEffect(() => {
    if (!isDictating) return;
    if (!isDisabled) return;
    stopDictation();
  }, [isDictating, isDisabled, stopDictation]);

  useEffect(() => {
    if (!plusMenuOpen && !suggestionsOpen && !settingsOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRegionRef.current?.contains(target)) return;
      setPlusMenuOpen(false);
      setSuggestionsOpen(false);
      setSettingsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPlusMenuOpen(false);
      setSuggestionsOpen(false);
      setSettingsOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [plusMenuOpen, suggestionsOpen, settingsOpen]);

  const handleSendPress = useCallback(() => {
    if (isDictating) {
      stopDictation();
    }
    onSend();
  }, [isDictating, stopDictation, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isReadOnly) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!isBusy && value.trim()) {
          handleSendPress();
        }
      }
    },
    [isBusy, isReadOnly, value, handleSendPress]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      onFilesSelected(event.target.files);
      event.currentTarget.value = "";
    },
    [isReadOnly, onFilesSelected]
  );

  const openOnly = (menu: "plus" | "suggestions" | "settings") => {
    setPlusMenuOpen(menu === "plus" ? (open) => !open : false);
    setSuggestionsOpen(menu === "suggestions" ? (open) => !open : false);
    setSettingsOpen(menu === "settings" ? (open) => !open : false);
  };

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      if (!isReadOnly && !isDisabled) {
        setIsDragActive(true);
      }
    },
    [isReadOnly, isDisabled]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect =
        isReadOnly || isDisabled ? "none" : "copy";
      if (!isReadOnly && !isDisabled) {
        setIsDragActive(true);
      }
    },
    [isReadOnly, isDisabled]
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragActive(false);

      if (isReadOnly || isDisabled) {
        return;
      }

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [isReadOnly, isDisabled, onFilesSelected]
  );

  const selectedTaskModels = selectedTask ? taskSuggestions[selectedTask] : [];

  return (
    <YStack gap="$xs">
      <YStack
        position="relative"
        gap={0}
        padding={0}
        backgroundColor="$background"
        borderRadius="$lg"
        borderWidth={1}
        borderColor={
          isDragActive ? "$success" : isFocused ? "$color" : "$border"
        }
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          boxShadow: "none",
        }}
      >
        {isDragActive && (
          <YStack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            pointerEvents="none"
            alignItems="center"
            justifyContent="center"
            zIndex={80}
            backgroundColor="rgba(34, 197, 94, 0.08)"
            borderRadius="$lg"
            borderWidth={2}
            borderColor="$success"
            borderStyle="dashed"
            gap="$xs"
          >
            <Upload size={18} color="#22C55E" />
            <Text fontSize={13} color="$success" fontWeight="600">
              Drop images or files to attach
            </Text>
          </YStack>
        )}

        {attachments.length > 0 && (
          <YStack
            gap="$xs"
            padding="$sm"
            borderBottomWidth={1}
            borderColor="$border"
            backgroundColor="$backgroundSecondary"
          >
            <Text fontSize={11} color="$textMuted" fontWeight="600">
              Attachments ({attachments.length})
            </Text>
            <XStack flexWrap="wrap" gap="$xs">
              {attachments.map((attachment, index) => (
                <AttachmentChip
                  key={`${attachment.name}-${index}`}
                  attachment={attachment}
                  onRemove={() => onRemoveAttachment(index)}
                />
              ))}
            </XStack>
          </YStack>
        )}

        <XStack alignItems="flex-end" gap="$sm">
          <XStack flex={1} position="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
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
        </XStack>

        <XStack
          alignItems="center"
          justifyContent="space-between"
          margin="$xs"
          padding="$xs"
          borderRadius="$md"
          backgroundColor="$backgroundSecondary"
          style={FLAT_BUTTON_STYLE}
        >
          <XStack
            alignItems="center"
            gap="$xs"
            position="relative"
            ref={menuRegionRef}
          >
            <span
              title="add files and more"
              style={{
                display: "flex",
                alignItems: "center",
                lineHeight: 0,
                verticalAlign: "top",
              }}
            >
              <Button
                size="$3"
                backgroundColor={
                  plusMenuOpen ? "$backgroundSecondary" : "transparent"
                }
                borderWidth={1}
                borderColor="$border"
                color="$textMuted"
                onPress={() => openOnly("plus")}
                aria-label="add files and more"
                disabled={isDisabled}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                  backgroundColor: "$backgroundSecondary",
                }}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.95 }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
              >
                <Text
                  fontSize={18}
                  lineHeight={18}
                  color="currentColor"
                  fontWeight="700"
                >
                  +
                </Text>
              </Button>
            </span>

            <span
              title="AI suggest - Get model reccomendations for your task"
              style={{
                display: "flex",
                alignItems: "center",
                lineHeight: 0,
                verticalAlign: "top",
              }}
            >
              <Button
                size="$3"
                backgroundColor={
                  suggestionsOpen ? "$backgroundSecondary" : "transparent"
                }
                borderWidth={1}
                borderColor="$border"
                color="$textMuted"
                onPress={() => openOnly("suggestions")}
                aria-label="AI suggest - Get model reccomendations for your task"
                disabled={isDisabled}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                  backgroundColor: "$backgroundSecondary",
                }}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.95 }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
              >
                <XStack alignItems="center" gap="$xs">
                  <Sparkles size={14} color="currentColor" />
                  <Text fontSize={12} color="currentColor">
                    Suggestions
                  </Text>
                </XStack>
              </Button>
            </span>

            <span
              title="adjust temperature and max tokens"
              style={{
                display: "flex",
                alignItems: "center",
                lineHeight: 0,
                verticalAlign: "top",
              }}
            >
              <Button
                size="$3"
                backgroundColor={
                  settingsOpen ? "$backgroundSecondary" : "transparent"
                }
                borderWidth={1}
                borderColor="$border"
                color="$textMuted"
                onPress={() => openOnly("settings")}
                aria-label="adjust temperature and max tokens"
                disabled={isDisabled}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                  backgroundColor: "$backgroundSecondary",
                }}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.95 }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
              >
                <Settings2 size={14} color="currentColor" />
              </Button>
            </span>

            {plusMenuOpen && (
              <YStack
                position="absolute"
                left={0}
                bottom="$xl"
                padding="$sm"
                backgroundColor="$background"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                gap="$xs"
                minWidth={230}
                zIndex={60}
              >
                <Button
                  size="$2"
                  justifyContent="flex-start"
                  icon={<ImagePlus size={14} />}
                  onPress={() => fileInputRef.current?.click()}
                >
                  Add photos & files
                </Button>
                <Button
                  size="$2"
                  justifyContent="flex-start"
                  backgroundColor={
                    mode === "deep" ? ACTIVE_MENU_BG : "transparent"
                  }
                  borderWidth={1}
                  borderColor={mode === "deep" ? ACTIVE_MENU_BG : "$border"}
                  color={mode === "deep" ? ACTIVE_MENU_TEXT : "$color"}
                  icon={<Brain size={14} />}
                  onPress={() => {
                    onModeChange(mode === "deep" ? "none" : "deep");
                  }}
                  hoverStyle={{
                    backgroundColor:
                      mode === "deep" ? ACTIVE_MENU_BG : "$backgroundSecondary",
                  }}
                >
                  Deep research
                </Button>
                <Button
                  size="$2"
                  justifyContent="flex-start"
                  backgroundColor={
                    mode === "fast" ? ACTIVE_MENU_BG : "transparent"
                  }
                  borderWidth={1}
                  borderColor={mode === "fast" ? ACTIVE_MENU_BG : "$border"}
                  color={mode === "fast" ? ACTIVE_MENU_TEXT : "$color"}
                  icon={<Zap size={14} />}
                  onPress={() => {
                    onModeChange(mode === "fast" ? "none" : "fast");
                  }}
                  hoverStyle={{
                    backgroundColor:
                      mode === "fast" ? ACTIVE_MENU_BG : "$backgroundSecondary",
                  }}
                >
                  Fast
                </Button>
                <Button
                  size="$2"
                  justifyContent="flex-start"
                  backgroundColor={showSteps ? ACTIVE_MENU_BG : "transparent"}
                  borderWidth={1}
                  borderColor={showSteps ? ACTIVE_MENU_BG : "$border"}
                  color={showSteps ? ACTIVE_MENU_TEXT : "$color"}
                  icon={<ListChecks size={14} />}
                  onPress={onToggleSteps}
                  hoverStyle={{
                    backgroundColor: showSteps
                      ? ACTIVE_MENU_BG
                      : "$backgroundSecondary",
                  }}
                >
                  Steps
                </Button>
                <Button
                  size="$2"
                  justifyContent="flex-start"
                  backgroundColor={
                    showCitations ? ACTIVE_MENU_BG : "transparent"
                  }
                  borderWidth={1}
                  borderColor={showCitations ? ACTIVE_MENU_BG : "$border"}
                  color={showCitations ? ACTIVE_MENU_TEXT : "$color"}
                  icon={<BookText size={14} />}
                  onPress={onToggleCitations}
                  hoverStyle={{
                    backgroundColor: showCitations
                      ? ACTIVE_MENU_BG
                      : "$backgroundSecondary",
                  }}
                >
                  Citations
                </Button>
              </YStack>
            )}

            {suggestionsOpen && (
              <YStack
                position="absolute"
                left={52}
                bottom="$xl"
                padding="$sm"
                backgroundColor="$background"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                gap="$xs"
                minWidth={320}
                zIndex={61}
              >
                <Text fontSize={12} fontWeight="600" color="$color">
                  What type of task are you working on?
                </Text>
                <XStack gap="$xs" flexWrap="wrap">
                  {(Object.keys(TASK_LABELS) as SuggestionTask[]).map(
                    (task) => (
                      <Button
                        key={task}
                        size="$2"
                        backgroundColor={
                          selectedTask === task ? "$color" : "transparent"
                        }
                        color={selectedTask === task ? "$background" : "$color"}
                        borderWidth={1}
                        borderColor="$border"
                        onPress={() => setSelectedTask(task)}
                      >
                        {TASK_LABELS[task]}
                      </Button>
                    )
                  )}
                </XStack>

                {selectedTaskModels.length > 0 && (
                  <YStack gap="$xs" marginTop="$xs">
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={11} color="$textMuted">
                        Top 3 model picks
                      </Text>
                      <Button
                        size="$1"
                        backgroundColor="transparent"
                        borderWidth={1}
                        borderColor="$border"
                        onPress={() =>
                          onAddSuggestedModelsToStack(
                            selectedTaskModels.map((model) => model.id)
                          )
                        }
                      >
                        Add top 3
                      </Button>
                    </XStack>
                    {selectedTaskModels.map((model) => (
                      <XStack
                        key={model.id}
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$xs"
                        borderWidth={1}
                        borderColor="$border"
                        borderRadius="$sm"
                        padding="$xs"
                      >
                        <YStack flex={1}>
                          <Text fontSize={12} color="$color" numberOfLines={1}>
                            {model.name}
                          </Text>
                          <Text
                            fontSize={10}
                            color="$textMuted"
                            numberOfLines={1}
                          >
                            {model.id}
                          </Text>
                        </YStack>
                        <XStack gap="$xs">
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor="$border"
                            onPress={() => onUseSuggestedAggregator(model.id)}
                          >
                            Aggregator
                          </Button>
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor="$border"
                            onPress={() =>
                              onAddSuggestedModelsToStack([model.id])
                            }
                          >
                            Add
                          </Button>
                        </XStack>
                      </XStack>
                    ))}
                  </YStack>
                )}
              </YStack>
            )}

            {settingsOpen && (
              <YStack
                position="absolute"
                left={196}
                bottom="$xl"
                padding="$sm"
                backgroundColor="$background"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                gap="$sm"
                minWidth={300}
                zIndex={62}
              >
                <YStack gap="$xs">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} fontWeight="600" color="$color">
                      Temperature
                    </Text>
                    <Text fontSize={11} color="$textMuted">
                      {temperature.toFixed(2)}
                    </Text>
                  </XStack>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={temperature}
                    onChange={(event) =>
                      onTemperatureChange(Number(event.currentTarget.value))
                    }
                    style={{ width: "100%" }}
                  />
                  <Text fontSize={11} color="$textMuted">
                    Lower = more focused, Higher = more creative
                  </Text>
                </YStack>

                <YStack gap="$xs">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} fontWeight="600" color="$color">
                      Max tokens
                    </Text>
                    <Text fontSize={11} color="$textMuted">
                      {Math.round(maxTokens)}
                    </Text>
                  </XStack>
                  <input
                    type="range"
                    min={256}
                    max={4096}
                    step={64}
                    value={maxTokens}
                    onChange={(event) =>
                      onMaxTokensChange(Number(event.currentTarget.value))
                    }
                    style={{ width: "100%" }}
                  />
                  <Text fontSize={11} color="$textMuted">
                    Maximum length of response
                  </Text>
                </YStack>
              </YStack>
            )}
          </XStack>

          <XStack alignItems="center" gap="$xs">
            <span
              title="click to start voice input"
              style={{
                display: "flex",
                alignItems: "center",
                lineHeight: 0,
                verticalAlign: "top",
              }}
            >
              <Button
                size="$3"
                backgroundColor={
                  isDictating ? "$backgroundSecondary" : "transparent"
                }
                borderWidth={1}
                borderColor="$border"
                color={isDictating ? "$color" : "$textMuted"}
                onPress={toggleDictation}
                aria-label="click to start voice input"
                disabled={isDisabled || !supportsDictation}
                opacity={isDisabled || !supportsDictation ? 0.5 : 1}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                  backgroundColor: "$backgroundSecondary",
                }}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.95 }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
              >
                {isDictating ? (
                  <MicOff size={18} color="currentColor" />
                ) : (
                  <Mic size={18} color="currentColor" />
                )}
              </Button>
            </span>
            {isBusy ? (
              <Button
                size="$3"
                backgroundColor="$red10"
                color="white"
                borderRadius="$md"
                onPress={onStop}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.98 }}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
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
                onPress={handleSendPress}
                disabled={isReadOnly || !value.trim()}
                opacity={!isReadOnly && value.trim() ? 1 : 0.5}
                pressStyle={{ ...FLAT_BUTTON_INTERACTION_STYLE, scale: 0.98 }}
                hoverStyle={{
                  ...FLAT_BUTTON_INTERACTION_STYLE,
                }}
                shadowColor="transparent"
                shadowOpacity={0}
                shadowRadius={0}
                elevation={0}
                style={FLAT_BUTTON_STYLE}
                icon={<Send size={18} />}
              >
                Send
              </Button>
            )}
          </XStack>
        </XStack>
      </YStack>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.doc,.docx,.csv,.json"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </YStack>
  );
}
