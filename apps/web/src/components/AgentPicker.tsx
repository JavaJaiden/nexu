"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { Check, ChevronDown, Crown, Search, Zap } from "lucide-react";
import type { ModelCard } from "@/lib/modelCatalog";
import { getCapabilitiesLabel, getProviderIcon } from "@/lib/modelCatalog";
import { categorizeModelTier, deriveCapabilityTags } from "@/lib/modelTier";

type AgentOption = {
  id: string;
  name: string;
  provider: string;
  capabilities: string;
  tier: "quick" | "pro";
  searchText: string;
  isAuto?: boolean;
};

type AgentPickerProps = {
  value: string;
  onChange: (value: string) => void;
  models: ModelCard[];
};

const AUTO_OPTION: AgentOption = {
  id: "auto",
  name: "Auto (Nexus routing)",
  provider: "Nexus",
  capabilities: "Routing • Balanced speed/quality",
  tier: "quick",
  searchText: "auto nexus routing router agent chat tools streaming function calling",
  isAuto: true,
};

function buildSearchText(model: ModelCard) {
  const capabilityTags = deriveCapabilityTags(model).join(" ");
  const capabilityLabel = getCapabilitiesLabel(model);
  return `${model.name} ${model.provider} ${capabilityLabel} ${capabilityTags}`.toLowerCase();
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
      <XStack alignItems="center" gap="$xs">
        {selected && <Check size={14} color="#22C55E" />}
      </XStack>
    </Button>
  );
}

function AgentSection({
  title,
  icon,
  options,
  selectedId,
  activeId,
  onSelect,
  showMore,
  onShowMore,
}: {
  title: string;
  icon: ReactNode;
  options: AgentOption[];
  selectedId: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  showMore: boolean;
  onShowMore: () => void;
}) {
  return (
    <YStack gap="$xs">
      <XStack alignItems="center" gap="$xs">
        {icon}
        <Text fontSize={12} fontWeight="600" color="$textMuted">
          {title}
        </Text>
      </XStack>
      <YStack gap="$xs">
        {options.map((option) => (
          <AgentRow
            key={option.id}
            option={option}
            selected={option.id === selectedId}
            active={option.id === activeId}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </YStack>
      {showMore && (
        <Button
          size="$2"
          backgroundColor="transparent"
          color="$textMuted"
          borderWidth={0}
          onPress={onShowMore}
        >
          Show more
        </Button>
      )}
    </YStack>
  );
}

export default function AgentPicker({ value, onChange, models }: AgentPickerProps) {
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
    (option: AgentOption) => {
      if (!isSearching) return true;
      return option.searchText.includes(searchQuery);
    },
    [isSearching, searchQuery]
  );

  const filteredQuick = useMemo(
    () => options.filter((option) => option.tier === "quick").filter(matchesSearch),
    [options, matchesSearch]
  );
  const filteredPro = useMemo(
    () => options.filter((option) => option.tier === "pro").filter(matchesSearch),
    [options, matchesSearch]
  );

  const showAuto = !isSearching || AUTO_OPTION.searchText.includes(searchQuery);
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
    const next: AgentOption[] = [];
    if (showAuto && matchesSearch(AUTO_OPTION)) next.push(AUTO_OPTION);
    next.push(...quickVisible, ...proVisible);
    return next;
  }, [quickVisible, proVisible, showAuto, matchesSearch]);

  const activeOption = flatOptions[activeIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    const index = flatOptions.findIndex((option) => option.id === value);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open, value, flatOptions]);

  const handleSelect = (id: string) => {
    onChange(id);
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
      handleSelect(activeOption.id);
    }
  };

  const selectedLabel =
    value === "auto"
      ? AUTO_OPTION.name
      : options.find((option) => option.id === value)?.name ?? value;

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
            <AgentSection
              title="Quick Agents"
              icon={<Zap size={14} color="#22C55E" />}
              options={[...(showAuto ? [AUTO_OPTION] : []), ...quickVisible]}
              selectedId={value}
              activeId={activeOption?.id ?? null}
              onSelect={handleSelect}
              showMore={quickHasMore}
              onShowMore={() => setExpandedQuick(true)}
            />
            <AgentSection
              title="Pro Agents"
              icon={<Crown size={14} color="#F59E0B" />}
              options={proVisible}
              selectedId={value}
              activeId={activeOption?.id ?? null}
              onSelect={handleSelect}
              showMore={proHasMore}
              onShowMore={() => setExpandedPro(true)}
            />
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
