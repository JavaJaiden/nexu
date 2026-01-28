"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { Check, ChevronDown, Crown, Search, Zap } from "lucide-react";
import type { ModelCard } from "@/lib/modelCatalog";
import { getCapabilitiesLabel, getProviderIcon } from "@/lib/modelCatalog";
import { categorizeModelTier, deriveCapabilityTags } from "@/lib/modelTier";
import type { LabPreset } from "@/lib/labStore";

type AgentOption = {
  id: string;
  name: string;
  provider: string;
  capabilities: string;
  tier: "quick" | "pro";
  searchText: string;
};

type PresetOption = {
  id: string;
  name: string;
  modelIds: string[];
  searchText: string;
};

type AgentStackPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  models: ModelCard[];
  presets?: LabPreset[];
  defaultCount: number;
};

const DEFAULT_OPTION = {
  id: "default-stack",
  name: "Default stack (Nexus routing)",
  provider: "Nexus",
  capabilities: "Auto routing • Balanced coverage",
  searchText: "default stack nexus routing router agent",
};

function buildSearchText(model: ModelCard) {
  const capabilityTags = deriveCapabilityTags(model).join(" ");
  const capabilityLabel = getCapabilitiesLabel(model);
  return `${model.name} ${model.provider} ${capabilityLabel} ${capabilityTags}`.toLowerCase();
}

function buildPresetSearchText(preset: LabPreset) {
  return `${preset.name} ${preset.subject} ${preset.models.join(" ")}`.toLowerCase();
}

function Row({
  title,
  subtitle,
  selected,
  active,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      size="$2"
      backgroundColor={active || selected ? "$backgroundSecondary" : "transparent"}
      borderWidth={1}
      borderColor={selected ? "$color" : "transparent"}
      borderRadius="$sm"
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      justifyContent="space-between"
      onPress={onSelect}
      hoverStyle={{ backgroundColor: "$backgroundSecondary" }}
    >
      <YStack flex={1} gap="$xxs">
        <Text fontSize={13} fontWeight="600" color="$color">
          {title}
        </Text>
        <Text fontSize={11} color="$textMuted">
          {subtitle}
        </Text>
      </YStack>
      {selected && <Check size={14} color="#22C55E" />}
    </Button>
  );
}

function AgentRow({
  option,
  selected,
  active,
  onSelect,
}: {
  option: AgentOption;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const providerIcon = getProviderIcon(option.provider);
  return (
    <Button
      size="$2"
      backgroundColor={active || selected ? "$backgroundSecondary" : "transparent"}
      borderWidth={1}
      borderColor={selected ? "$color" : "transparent"}
      borderRadius="$sm"
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      justifyContent="space-between"
      onPress={onSelect}
      hoverStyle={{ backgroundColor: "$backgroundSecondary" }}
    >
      <XStack alignItems="center" gap="$sm" flex={1}>
        <Text fontSize={14} color="$textMuted">
          {providerIcon}
        </Text>
        <YStack flex={1} gap="$xxs">
          <Text fontSize={13} fontWeight="600" color="$color">
            {option.name}
          </Text>
          <Text fontSize={11} color="$textMuted">
            {option.provider} — {option.capabilities}
          </Text>
        </YStack>
      </XStack>
      {selected && <Check size={14} color="#22C55E" />}
    </Button>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <XStack alignItems="center" gap="$xs">
      {icon}
      <Text fontSize={12} fontWeight="600" color="$textMuted">
        {title}
      </Text>
    </XStack>
  );
}

export default function AgentStackPicker({
  selectedIds,
  onChange,
  models,
  presets = [],
  defaultCount,
}: AgentStackPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQuick, setExpandedQuick] = useState(false);
  const [expandedPro, setExpandedPro] = useState(false);
  const [capSize, setCapSize] = useState(6);
  const [activeIndex, setActiveIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const isDefault = selectedIds.length < 2;

  const options = useMemo(() => {
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      capabilities: getCapabilitiesLabel(model),
      tier: categorizeModelTier(model),
      searchText: buildSearchText(model),
    }));
  }, [models]);

  const presetOptions = useMemo<PresetOption[]>(
    () =>
      presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        modelIds: preset.models,
        searchText: buildPresetSearchText(preset),
      })),
    [presets]
  );

  const proCount = useMemo(() => options.filter((option) => option.tier === "pro").length, [options]);
  const modelCount = options.length;
  const agentCount = modelCount;

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setCapSize(window.innerWidth >= 1280 ? 8 : 6);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const isSearching = searchQuery.length > 0;
  const matchesSearch = useCallback(
    (text: string) => {
      if (!isSearching) return true;
      return text.includes(searchQuery);
    },
    [isSearching, searchQuery]
  );

  const filteredQuick = useMemo(
    () => options.filter((option) => option.tier === "quick").filter((option) => matchesSearch(option.searchText)),
    [options, matchesSearch]
  );
  const filteredPro = useMemo(
    () => options.filter((option) => option.tier === "pro").filter((option) => matchesSearch(option.searchText)),
    [options, matchesSearch]
  );
  const filteredPresets = useMemo(
    () => presetOptions.filter((preset) => matchesSearch(preset.searchText)),
    [presetOptions, matchesSearch]
  );

  const showDefault = !isSearching || DEFAULT_OPTION.searchText.includes(searchQuery);

  const quickVisible = useMemo(() => {
    if (isSearching || expandedQuick) return filteredQuick;
    return filteredQuick.slice(0, capSize);
  }, [filteredQuick, isSearching, expandedQuick, capSize]);
  const proVisible = useMemo(() => {
    if (isSearching || expandedPro) return filteredPro;
    return filteredPro.slice(0, capSize);
  }, [filteredPro, isSearching, expandedPro, capSize]);

  const quickHasMore = !isSearching && filteredQuick.length > capSize && !expandedQuick;
  const proHasMore = !isSearching && filteredPro.length > capSize && !expandedPro;

  const flatOptions = useMemo(() => {
    const next: Array<{ id: string; kind: "default" | "preset" | "agent" }> = [];
    if (showDefault) next.push({ id: DEFAULT_OPTION.id, kind: "default" });
    filteredPresets.forEach((preset) => next.push({ id: `preset:${preset.id}`, kind: "preset" }));
    quickVisible.forEach((option) => next.push({ id: option.id, kind: "agent" }));
    proVisible.forEach((option) => next.push({ id: option.id, kind: "agent" }));
    return next;
  }, [showDefault, filteredPresets, quickVisible, proVisible]);

  const activeOption = flatOptions[activeIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open]);

  const handleSelectModel = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  const handleSelectPreset = (preset: PresetOption) => {
    onChange(preset.modelIds);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(flatOptions.length - 1, prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      if (activeOption.kind === "default") {
        onChange([]);
        setOpen(false);
        return;
      }
      if (activeOption.kind === "preset") {
        const presetId = activeOption.id.replace("preset:", "");
        const preset = presetOptions.find((entry) => entry.id === presetId);
        if (preset) handleSelectPreset(preset);
        return;
      }
      handleSelectModel(activeOption.id);
    }
  };

  const selectedLabel = isDefault
    ? `Default stack (${defaultCount})`
    : `Stacked models (${selectedIds.length})`;

  return (
    <YStack position="relative" width="100%" maxWidth={360}>
      <Button
        ref={triggerRef}
        size="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$border"
        color="$color"
        borderRadius="$sm"
        onPress={() => setOpen((prev) => !prev)}
      >
        <XStack alignItems="center" justifyContent="space-between" width="100%">
          <Text fontSize={13} color="$color">
            {selectedLabel}
          </Text>
          <ChevronDown size={14} color="#9CA3AF" />
        </XStack>
      </Button>

      {open && (
        <YStack
          ref={panelRef}
          position="absolute"
          top="$lg"
          left={0}
          zIndex={30}
          width={360}
          height={560}
          borderWidth={1}
          borderColor="$border"
          borderRadius="$md"
          backgroundColor="$background"
          overflow="hidden"
          onKeyDown={handleKeyDown}
        >
          <YStack padding="$sm" borderBottomWidth={1} borderColor="$border" gap="$sm">
            <XStack alignItems="center" gap="$xs">
              <Search size={14} color="#9CA3AF" />
              <Input
                ref={searchRef}
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search agents..."
                flex={1}
                borderColor="$border"
                backgroundColor="$background"
                fontSize={12}
                padding="$xs"
              />
            </XStack>
          </YStack>

          <YStack flex={1} overflowY="auto" padding="$sm" gap="$lg">
            <YStack gap="$xs">
              <SectionHeader icon={<Zap size={14} color="#22C55E" />} title="Quick Agents" />
              <YStack gap="$xs">
                {showDefault && (
                  <Row
                    title={DEFAULT_OPTION.name}
                    subtitle={DEFAULT_OPTION.capabilities}
                    selected={isDefault}
                    active={activeOption?.id === DEFAULT_OPTION.id}
                    onSelect={() => {
                      onChange([]);
                      setOpen(false);
                    }}
                  />
                )}
                {filteredPresets.length > 0 && (
                  <YStack gap="$xs">
                    <Text fontSize={11} color="$textMuted">
                      Saved stacks
                    </Text>
                    {filteredPresets.map((preset) => {
                      const presetSelected =
                        preset.modelIds.length > 0 &&
                        preset.modelIds.length === selectedIds.length &&
                        preset.modelIds.every((modelId) => selectedIds.includes(modelId));
                      return (
                        <Row
                          key={preset.id}
                          title={preset.name}
                          subtitle={`${preset.modelIds.length} models`}
                          selected={presetSelected}
                          active={activeOption?.id === `preset:${preset.id}`}
                          onSelect={() => handleSelectPreset(preset)}
                        />
                      );
                    })}
                  </YStack>
                )}
                {quickVisible.map((option) => (
                  <AgentRow
                    key={option.id}
                    option={option}
                    selected={selectedIds.includes(option.id)}
                    active={activeOption?.id === option.id}
                    onSelect={() => handleSelectModel(option.id)}
                  />
                ))}
              </YStack>
              {quickHasMore && (
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  color="$textMuted"
                  borderWidth={0}
                  onPress={() => setExpandedQuick(true)}
                >
                  Show more
                </Button>
              )}
            </YStack>

            <YStack gap="$xs">
              <SectionHeader icon={<Crown size={14} color="#F59E0B" />} title="Pro Agents" />
              <YStack gap="$xs">
                {proVisible.map((option) => (
                  <AgentRow
                    key={option.id}
                    option={option}
                    selected={selectedIds.includes(option.id)}
                    active={activeOption?.id === option.id}
                    onSelect={() => handleSelectModel(option.id)}
                  />
                ))}
              </YStack>
              {proHasMore && (
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  color="$textMuted"
                  borderWidth={0}
                  onPress={() => setExpandedPro(true)}
                >
                  Show more
                </Button>
              )}
            </YStack>

            {flatOptions.length === 0 && (
              <Paragraph fontSize={12} color="$textMuted">
                No agents match that search.
              </Paragraph>
            )}
          </YStack>

          <YStack padding="$sm" borderTopWidth={1} borderColor="$border" gap="$xs">
            <Text fontSize={12} color="$textMuted">
              {agentCount} agents available • {modelCount} models
            </Text>
            <XStack alignItems="center" justifyContent="space-between" gap="$sm">
              <Text fontSize={12} color="$textMuted">
                {proCount} pro agents available with upgrade
              </Text>
              <Button
                size="$2"
                backgroundColor="$color"
                color="$background"
                borderRadius="$full"
                onPress={() => {}}
              >
                Upgrade
              </Button>
            </XStack>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
