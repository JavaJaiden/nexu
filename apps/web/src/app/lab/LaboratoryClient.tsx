"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  H1,
  H2,
  Paragraph,
  Text,
  XStack,
  YStack,
  Input,
} from "tamagui";
import {
  Beaker,
  Upload,
  FileText,
  Database,
  Bot,
  Workflow,
  Search,
  Grid3X3,
  List,
  Plus,
  MoreHorizontal,
  X,
  ChevronRight,
  Lock,
  Users,
  Star,
  Clock,
  Sparkles,
  Filter,
  Settings,
  Trash2,
  Edit3,
  Play,
  Layers,
} from "lucide-react";
import Header from "@/components/Header";
import { useThemeSetting } from "@/lib/themeContext";
import { getProviderIcon, getModelHubCards, type ModelCard } from "@/lib/modelCatalog";
import {
  loadLabPresets,
  removeLabPreset,
  type LabPreset,
} from "@/lib/labStore";

// ============================================================================
// TYPES
// ============================================================================

type AssetType = "model" | "dataset" | "file" | "agent" | "workflow" | "pipeline";
type AssetScope = "private" | "organization";
type ComplexityLevel = "simple" | "moderate" | "advanced" | "enterprise";

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  scope: AssetScope;
  complexity: ComplexityLevel;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  usageCount: number;
  rating?: number;
  icon?: string;
  models?: string[];
}

// ============================================================================
// MOCK DATA & UTILS
// ============================================================================

const assetTypeIcons: Record<AssetType, typeof Beaker> = {
  model: Bot,
  dataset: Database,
  file: FileText,
  agent: Sparkles,
  workflow: Workflow,
  pipeline: Layers,
};

const assetTypeColors: Record<AssetType, string> = {
  model: "#22C55E",
  dataset: "#3B82F6",
  file: "#F59E0B",
  agent: "#8B5CF6",
  workflow: "#EC4899",
  pipeline: "#14B8A6",
};

const complexityLabels: Record<ComplexityLevel, string> = {
  simple: "Simple",
  moderate: "Moderate",
  advanced: "Advanced",
  enterprise: "Enterprise",
};

// Convert presets to assets
function presetsToAssets(presets: LabPreset[]): Asset[] {
  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    type: "model",
    scope: "private",
    complexity: "simple",
    description: `${preset.models.length} models for ${preset.subject || "general"} tasks`,
    tags: [preset.subject || "General", "preset"],
    createdAt: preset.createdAt,
    updatedAt: preset.createdAt,
    author: "You",
    usageCount: 0,
    models: preset.models,
  }));
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LaboratoryPage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const isDark = theme === "dark";

  // Theme colors
  const colors = useMemo(
    () => ({
      bg: "var(--app-bg, var(--background))",
      bgSecondary: "var(--app-bg-secondary, var(--backgroundSecondary, var(--app-bg)))",
      bgTertiary: "var(--app-bg-secondary, var(--backgroundSecondary, var(--app-bg)))",
      border: "var(--app-border, var(--border))",
      text: "var(--app-text, var(--color))",
      textMuted: "var(--app-muted, var(--textMuted, var(--app-text)))",
      textSecondary: "var(--app-subtle, var(--textSubtle, var(--textMuted)))",
      accent: "#22C55E",
      accentBg: isDark ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.1)",
      gold: "#F59E0B",
      blue: "#3B82F6",
      red: "#EF4444",
    }),
    [isDark]
  );

  // State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [scopeFilter, setScopeFilter] = useState<AssetScope | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "usage" | "rating">("recent");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const modelCatalog = useMemo(() => getModelHubCards(), []);
  const modelMetaMap = useMemo(
    () => new Map(modelCatalog.map((m) => [m.id, m])),
    [modelCatalog]
  );

  // Load assets
  useEffect(() => {
    const presets = loadLabPresets();
    setAssets(presetsToAssets(presets));

    const handler = () => {
      const updatedPresets = loadLabPresets();
      setAssets(presetsToAssets(updatedPresets));
    };
    window.addEventListener("lab-presets-updated", handler);
    return () => window.removeEventListener("lab-presets-updated", handler);
  }, []);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (asset) =>
          asset.name.toLowerCase().includes(query) ||
          asset.description?.toLowerCase().includes(query) ||
          asset.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Scope filter
    if (scopeFilter !== "all") {
      result = result.filter((asset) => asset.scope === scopeFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((asset) => asset.type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "usage") {
        return b.usageCount - a.usageCount;
      }
      return (b.rating || 0) - (a.rating || 0);
    });

    return result;
  }, [assets, searchQuery, scopeFilter, typeFilter, sortBy]);

  const handleDeletePreset = useCallback((id: string) => {
    removeLabPreset(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (selectedAsset?.id === id) {
      setSelectedAsset(null);
    }
  }, [selectedAsset]);

  const handleUsePreset = useCallback(
    (asset: Asset) => {
      if (asset.models && asset.models.length > 0) {
        router.push(`/studio?stack=${asset.models.join(",")}`);
      }
    },
    [router]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const assetCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assets.length };
    assets.forEach((asset) => {
      counts[asset.type] = (counts[asset.type] || 0) + 1;
      counts[asset.scope] = (counts[asset.scope] || 0) + 1;
    });
    return counts;
  }, [assets]);

  return (
    <YStack flex={1} backgroundColor={colors.bg} minHeight="100vh">
      <Header />

      <YStack flex={1} maxWidth={1600} width="100%" marginHorizontal="auto">
        {/* Early Alpha Banner */}
        <XStack
          padding="$md"
          backgroundColor={isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)"}
          borderBottomWidth={1}
          borderColor={isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)"}
          alignItems="center"
          gap="$md"
          justifyContent="center"
        >
          <Beaker size={18} color={colors.gold} />
          <Text fontSize={14} color={colors.gold}>
            Early Alpha Preview — Features may change rapidly. This is where we test advanced capabilities before moving them into Studio.
          </Text>
        </XStack>

        <XStack flex={1}>
          {/* Left Sidebar - Navigation */}
          <YStack
            width={280}
            minWidth={280}
            padding="$lg"
            gap="$lg"
            borderRightWidth={1}
            borderColor={colors.border}
            backgroundColor={colors.bgSecondary}
          >
            {/* Header */}
            <YStack gap="$xs">
              <H1 fontSize={28} fontWeight="700" color={colors.text}>
                Laboratory
              </H1>
              <Paragraph color={colors.textMuted} fontSize={14}>
                Nexus's experimental workspace for building, testing, and managing AI assets.
              </Paragraph>
            </YStack>

            {/* Create Button */}
            <YStack position="relative">
              <Button
                size="$4"
                backgroundColor={colors.accent}
                color="black"
                borderRadius="$md"
                fontWeight="600"
                onPress={() => setShowCreateMenu(!showCreateMenu)}
                icon={<Plus size={18} />}
              >
                Create New
              </Button>

              {showCreateMenu && (
                <YStack
                  position="absolute"
                  top="$lg"
                  left={0}
                  right={0}
                  zIndex={50}
                  backgroundColor={colors.bg}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius="$md"
                  padding="$sm"
                  gap="$xs"
                >
                  {[
                    { type: "agent", label: "AI Agent", icon: Sparkles },
                    { type: "workflow", label: "Workflow", icon: Workflow },
                    { type: "pipeline", label: "Pipeline", icon: Layers },
                    { type: "dataset", label: "Dataset", icon: Database },
                    { type: "file", label: "Upload Files", icon: Upload },
                  ].map(({ type, label, icon: Icon }) => (
                    <Button
                      key={type}
                      size="$3"
                      backgroundColor="transparent"
                      color={colors.text}
                      justifyContent="flex-start"
                      icon={<Icon size={16} color={assetTypeColors[type as AssetType]} />}
                      onPress={() => {
                        setShowCreateMenu(false);
                        // TODO: Navigate to creation flow
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </YStack>
              )}
            </YStack>

            {/* Scope Filter */}
            <YStack gap="$sm">
              <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                Scope
              </Text>
              <YStack gap="$xs">
                {[
                  { key: "all", label: "All Assets", count: assetCounts.all },
                  { key: "private", label: "Private", count: assetCounts.private || 0, icon: Lock },
                  { key: "organization", label: "Organization", count: assetCounts.organization || 0, icon: Users },
                ].map(({ key, label, count, icon: Icon }) => (
                  <Button
                    key={key}
                    size="$3"
                    backgroundColor={scopeFilter === key ? colors.bgTertiary : "transparent"}
                    borderWidth={1}
                    borderColor={scopeFilter === key ? colors.border : "transparent"}
                    color={colors.text}
                    justifyContent="space-between"
                    onPress={() => setScopeFilter(key as any)}
                    icon={Icon ? <Icon size={14} /> : undefined}
                  >
                    <XStack justifyContent="space-between" width="100%">
                      <Text fontSize={13} color={colors.text}>
                        {label}
                      </Text>
                      <Text fontSize={12} color={colors.textMuted}>
                        {count}
                      </Text>
                    </XStack>
                  </Button>
                ))}
              </YStack>
            </YStack>

            {/* Asset Types */}
            <YStack gap="$sm">
              <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                Asset Types
              </Text>
              <YStack gap="$xs">
                {[
                  { type: "model", label: "Models", icon: Bot },
                  { type: "agent", label: "Agents", icon: Sparkles },
                  { type: "workflow", label: "Workflows", icon: Workflow },
                  { type: "pipeline", label: "Pipelines", icon: Layers },
                  { type: "dataset", label: "Datasets", icon: Database },
                  { type: "file", label: "Files", icon: FileText },
                ].map(({ type, label, icon: Icon }) => (
                  <Button
                    key={type}
                    size="$3"
                    backgroundColor={typeFilter === type ? colors.bgTertiary : "transparent"}
                    borderWidth={1}
                    borderColor={typeFilter === type ? colors.border : "transparent"}
                    color={colors.text}
                    justifyContent="flex-start"
                    onPress={() => setTypeFilter(typeFilter === type ? "all" : (type as AssetType))}
                    icon={<Icon size={14} color={assetTypeColors[type as AssetType]} />}
                  >
                    <XStack justifyContent="space-between" width="100%">
                      <Text fontSize={13} color={colors.text}>
                        {label}
                      </Text>
                      <Text fontSize={12} color={colors.textMuted}>
                        {assetCounts[type] || 0}
                      </Text>
                    </XStack>
                  </Button>
                ))}
              </YStack>
            </YStack>

            {/* Complexity Filter */}
            <YStack gap="$sm">
              <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                Complexity
              </Text>
              <YStack gap="$xs">
                {["simple", "moderate", "advanced", "enterprise"].map((level) => (
                  <Text
                    key={level}
                    fontSize={12}
                    color={colors.textSecondary}
                    textTransform="capitalize"
                    padding="$xs"
                    backgroundColor={colors.bgTertiary}
                    borderRadius="$sm"
                  >
                    {level}
                  </Text>
                ))}
              </YStack>
            </YStack>
          </YStack>

          {/* Main Content - Asset Gallery */}
          <YStack flex={1} padding="$lg" gap="$lg">
            {/* Toolbar */}
            <XStack justifyContent="space-between" alignItems="center" gap="$md">
              <XStack flex={1} maxWidth={400} alignItems="center" gap="$xs" paddingHorizontal="$md" paddingVertical="$sm" backgroundColor={colors.bgSecondary} borderRadius="$md" borderWidth={1} borderColor={colors.border}>
                <Search size={18} color={colors.textMuted} />
                <Input
                  flex={1}
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={colors.text}
                  placeholder="Search assets..."
                  placeholderTextColor={colors.textSecondary}
                  fontSize={14}
                  padding="$xs"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery && (
                  <Button
                    size="$1"
                    backgroundColor="transparent"
                    borderWidth={0}
                    onPress={() => setSearchQuery("")}
                    icon={<X size={16} color={colors.textMuted} />}
                  />
                )}
              </XStack>

              <XStack gap="$sm" alignItems="center">
                {/* Sort Toggle */}
                <XStack borderWidth={1} borderColor={colors.border} borderRadius="$md" overflow="hidden">
                  {[
                    { value: "recent", label: "Most Recent" },
                    { value: "usage", label: "Most Used" },
                    { value: "rating", label: "Highest Rated" },
                  ].map((option) => {
                    const isActive = sortBy === option.value;
                    return (
                      <Button
                        key={option.value}
                        size="$2"
                        backgroundColor={isActive ? colors.bgTertiary : "transparent"}
                        color={isActive ? colors.text : colors.textMuted}
                        borderWidth={0}
                        borderRadius={0}
                        onPress={() => setSortBy(option.value as any)}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </XStack>

                {/* View Toggle */}
                <XStack borderWidth={1} borderColor={colors.border} borderRadius="$md" overflow="hidden">
                  <Button
                    size="$2"
                    backgroundColor={viewMode === "grid" ? colors.bgTertiary : "transparent"}
                    borderWidth={0}
                    borderRadius={0}
                    onPress={() => setViewMode("grid")}
                    icon={<Grid3X3 size={16} color={viewMode === "grid" ? colors.text : colors.textMuted} />}
                  />
                  <Button
                    size="$2"
                    backgroundColor={viewMode === "list" ? colors.bgTertiary : "transparent"}
                    borderWidth={0}
                    borderRadius={0}
                    onPress={() => setViewMode("list")}
                    icon={<List size={16} color={viewMode === "list" ? colors.text : colors.textMuted} />}
                  />
                </XStack>
              </XStack>
            </XStack>

            {/* Assets Grid/List */}
            {filteredAssets.length === 0 ? (
              <YStack flex={1} alignItems="center" justifyContent="center" gap="$lg">
                <YStack
                  width={120}
                  height={120}
                  backgroundColor={colors.bgTertiary}
                  borderRadius="$lg"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Beaker size={48} color={colors.border} />
                </YStack>
                <YStack alignItems="center" gap="$sm" maxWidth={400}>
                  <H2 fontSize={20} fontWeight="600" color={colors.text}>
                    {assets.length === 0 ? "Your Laboratory is empty" : "No assets match your filters"}
                  </H2>
                  <Paragraph color={colors.textMuted} textAlign="center">
                    {assets.length === 0
                      ? "Start by creating AI assets, uploading files, or saving model presets from the Model Hub."
                      : "Try adjusting your search or filters to find what you're looking for."}
                  </Paragraph>
                </YStack>
                {assets.length === 0 && (
                  <XStack gap="$sm">
                    <Button
                      size="$3"
                      backgroundColor={colors.accent}
                      color="black"
                      onPress={() => router.push("/models")}
                      icon={<Bot size={16} />}
                    >
                      Browse Models
                    </Button>
                    <Button
                      size="$3"
                      backgroundColor={colors.bgTertiary}
                      color={colors.text}
                      borderWidth={1}
                      borderColor={colors.border}
                      icon={<Upload size={16} />}
                    >
                      Upload Files
                    </Button>
                  </XStack>
                )}
              </YStack>
            ) : (
              <YStack
                {...(viewMode === "grid"
                  ? {
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: "$md",
                    }
                  : {
                      gap: "$sm",
                    })}
              >
                {filteredAssets.map((asset) => {
                  const Icon = assetTypeIcons[asset.type];
                  const isSelected = selectedAsset?.id === asset.id;

                  if (viewMode === "list") {
                    return (
                      <XStack
                        key={asset.id}
                        padding="$md"
                        backgroundColor={isSelected ? colors.bgTertiary : colors.bgSecondary}
                        borderWidth={1}
                        borderColor={isSelected ? colors.accent : colors.border}
                        borderRadius="$md"
                        alignItems="center"
                        gap="$md"
                        hoverStyle={{ backgroundColor: colors.bgTertiary }}
                        onPress={() => setSelectedAsset(asset)}
                      >
                        <YStack
                          width={40}
                          height={40}
                          backgroundColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                          borderRadius="$md"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon size={20} color={assetTypeColors[asset.type]} />
                        </YStack>

                        <YStack flex={1}>
                          <Text fontSize={15} fontWeight="600" color={colors.text}>
                            {asset.name}
                          </Text>
                          <Text fontSize={12} color={colors.textMuted}>
                            {asset.description}
                          </Text>
                        </YStack>

                        <XStack gap="$xs" alignItems="center">
                          {asset.models?.slice(0, 3).map((modelId) => (
                            <Text key={modelId} fontSize={12} color={colors.textSecondary}>
                              {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                            </Text>
                          ))}
                          {asset.models && asset.models.length > 3 && (
                            <Text fontSize={11} color={colors.textMuted}>
                              +{asset.models.length - 3}
                            </Text>
                          )}
                        </XStack>

                        <XStack gap="$sm" alignItems="center">
                          {asset.scope === "private" ? (
                            <Lock size={14} color={colors.textMuted} />
                          ) : (
                            <Users size={14} color={colors.textMuted} />
                          )}
                          <Text fontSize={12} color={colors.textMuted}>
                            {formatDate(asset.createdAt)}
                          </Text>
                        </XStack>

                        <XStack gap="$xs">
                          <Button
                            size="$2"
                            backgroundColor={colors.accent}
                            color="black"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleUsePreset(asset);
                            }}
                            icon={<Play size={14} />}
                          >
                            Use
                          </Button>
                          <Button
                            size="$2"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor={colors.border}
                            color={colors.text}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePreset(asset.id);
                            }}
                            icon={<Trash2 size={14} />}
                          />
                        </XStack>
                      </XStack>
                    );
                  }

                  // Grid view
                  return (
                    <YStack
                      key={asset.id}
                      width={280}
                      padding="$md"
                      backgroundColor={isSelected ? colors.bgTertiary : colors.bgSecondary}
                      borderWidth={1}
                      borderColor={isSelected ? colors.accent : colors.border}
                      borderRadius="$lg"
                      gap="$md"
                      hoverStyle={{ backgroundColor: colors.bgTertiary }}
                      onPress={() => setSelectedAsset(asset)}
                    >
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack
                          width={48}
                          height={48}
                          backgroundColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                          borderRadius="$lg"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon size={24} color={assetTypeColors[asset.type]} />
                        </YStack>
                        <XStack gap="$xs">
                          {asset.scope === "private" ? (
                            <Lock size={14} color={colors.textMuted} />
                          ) : (
                            <Users size={14} color={colors.textMuted} />
                          )}
                        </XStack>
                      </XStack>

                      <YStack gap="$xs">
                        <Text fontSize={16} fontWeight="600" color={colors.text}>
                          {asset.name}
                        </Text>
                        <Text fontSize={13} color={colors.textMuted} numberOfLines={2}>
                          {asset.description}
                        </Text>
                      </YStack>

                      <XStack flexWrap="wrap" gap="$xs">
                        {asset.tags.map((tag) => (
                          <Text
                            key={tag}
                            fontSize={11}
                            color={colors.textSecondary}
                            backgroundColor={colors.bgTertiary}
                            paddingHorizontal="$xs"
                            paddingVertical={4}
                            borderRadius="$sm"
                          >
                            {tag}
                          </Text>
                        ))}
                      </XStack>

                      {asset.models && asset.models.length > 0 && (
                        <XStack alignItems="center" gap="$xs">
                          <Text fontSize={11} color={colors.textMuted}>
                            Models:
                          </Text>
                          {asset.models.slice(0, 4).map((modelId) => (
                            <Text key={modelId} fontSize={12} color={colors.textSecondary}>
                              {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                            </Text>
                          ))}
                          {asset.models.length > 4 && (
                            <Text fontSize={11} color={colors.textMuted}>
                              +{asset.models.length - 4}
                            </Text>
                          )}
                        </XStack>
                      )}

                      <XStack justifyContent="space-between" alignItems="center" marginTop="$xs">
                        <Text fontSize={12} color={colors.textMuted}>
                          {formatDate(asset.createdAt)}
                        </Text>
                        <XStack gap="$xs">
                          <Button
                            size="$2"
                            backgroundColor={colors.accent}
                            color="black"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleUsePreset(asset);
                            }}
                            icon={<Play size={14} />}
                          >
                            Use
                          </Button>
                          <Button
                            size="$2"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor={colors.border}
                            color={colors.text}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePreset(asset.id);
                            }}
                            icon={<Trash2 size={14} />}
                          />
                        </XStack>
                      </XStack>
                    </YStack>
                  );
                })}
              </YStack>
            )}
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}
