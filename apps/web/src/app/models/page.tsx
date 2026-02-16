"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import {
  Button,
  H1,
  Input,
  Paragraph,
  Text,
  XStack,
  YStack,
  ScrollView,
  Theme,
} from "tamagui";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Search,
  X,
  Trophy,
  Zap,
  Brain,
  Code2,
  Calculator,
  Sparkles,
  Info,
  DollarSign,
  Gauge,
  Clock,
  TrendingUp,
  MessageSquare,
  Bot,
  Send,
  Paperclip,
  Mic,
  MicOff,
  ChevronUp,
  BarChart3,
  Award,
} from "lucide-react";
import Header from "@/components/Header";
import { loadHistory, type HistoryEntry } from "@/lib/historyStore";
import {
  buildModelHubCardsFromIds,
  getProviderIcon,
  type ModelCard,
} from "@/lib/modelCatalog";
import { useThemeSetting } from "@/lib/themeContext";
import { loadLabPresets, upsertLabPreset, type LabPreset } from "@/lib/labStore";
import { fileToAttachment, isPdfFile } from "@/lib/attachments";
import type { PdfAttachment } from "@/lib/externalContext";
import { useSpeechDictation } from "@/lib/useSpeechDictation";

// ============================================================================
// TYPES
// ============================================================================

type SortKey = "overall" | "coding" | "math" | "reasoning" | "price" | "name" | "speed";
type SortDir = "asc" | "desc";
type ChatMode = "compare" | "discover" | null;
type PriceTier = "free" | "budget" | "standard" | "premium" | "enterprise" | "unknown";

interface DetailedModelData {
  id: string;
  rank: number;
  model: ModelCard;
  leaderboard?: ConvexLeaderboardModel;
  scores: {
    overall: number | null;
    coding: number | null;
    math: number | null;
    reasoning: number | null;
    vision: number | null;
    multilingual: number | null;
    instructionFollowing: number | null;
  };
  pricing: {
    input: number | null;
    output: number | null;
    tier: PriceTier;
  };
  capabilities: string[];
  benchmarks: {
    name: string;
    score: number;
    percentile: number;
  }[];
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    tokensPerSecond: number;
    requestsPerMinute: number;
  };
  contextWindow: number;
  trainingCutoff: string;
  releaseDate: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  useCases: string[];
  isSelected?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: Array<{ id: string; reason: string; confidence: number }>;
}

type ConvexLeaderboardModel = {
  id: string;
  source: "openrouter";
  modelId: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt?: number; completion?: number };
  capabilities: string[];
  availability: "available" | "unknown";
  updatedAt: number;
};

type ConvexLeaderboardFilters = {
  providers: string[];
  capabilities: string[];
  count: number;
};

const convexApi = anyApi as any;

const NEXUS_ROUTING_MODEL_IDS = new Set(["Nexus-Core", "Nexus-Math", "Nexus-Code", "Nexus-Write"]);

// ============================================================================
// MOCK DATA SOURCES
// ============================================================================

const ENHANCED_MODEL_DATA: Record<string, Partial<DetailedModelData>> = {
  "gpt-4o": {
    scores: { overall: 96, coding: 94, math: 93, reasoning: 95, vision: 92, multilingual: 91, instructionFollowing: 95 },
    pricing: { input: 2.5, output: 10, tier: "premium" },
    benchmarks: [
      { name: "MMLU", score: 88.7, percentile: 99 },
      { name: "HumanEval", score: 90.2, percentile: 98 },
      { name: "GSM8K", score: 92.9, percentile: 97 },
      { name: "MATH", score: 76.6, percentile: 95 },
    ],
    latency: { avg: 320, p50: 280, p95: 580, p99: 850 },
    throughput: { tokensPerSecond: 142, requestsPerMinute: 3000 },
    contextWindow: 128000,
    trainingCutoff: "2024-05",
    releaseDate: "2024-05-13",
    description: "OpenAI's flagship model with exceptional reasoning, coding, and vision capabilities. Excels at complex problem-solving and creative tasks.",
    strengths: ["Advanced reasoning", "Code generation", "Vision understanding", "Long context"],
    weaknesses: ["Higher cost", "Occasional overconfidence"],
    useCases: ["Enterprise apps", "Code review", "Document analysis", "Creative writing"],
  },
  "claude-3-5-sonnet": {
    scores: { overall: 95, coding: 93, math: 91, reasoning: 96, vision: 89, multilingual: 90, instructionFollowing: 94 },
    pricing: { input: 3, output: 15, tier: "premium" },
    benchmarks: [
      { name: "MMLU", score: 88.5, percentile: 99 },
      { name: "HumanEval", score: 92.0, percentile: 99 },
      { name: "GSM8K", score: 95.0, percentile: 99 },
      { name: "MATH", score: 71.1, percentile: 93 },
    ],
    latency: { avg: 450, p50: 380, p95: 720, p99: 1100 },
    throughput: { tokensPerSecond: 98, requestsPerMinute: 2000 },
    contextWindow: 200000,
    trainingCutoff: "2024-04",
    releaseDate: "2024-06-20",
    description: "Anthropic's most capable model with nuanced reasoning and exceptional safety characteristics. Strong at analysis and writing.",
    strengths: ["Long context window", "Safe outputs", "Creative writing", "Analysis"],
    weaknesses: ["Slower response times", "Premium pricing"],
    useCases: ["Research analysis", "Content creation", "Legal review", "Medical Q&A"],
  },
  "gemini-1.5-pro": {
    scores: { overall: 94, coding: 88, math: 90, reasoning: 93, vision: 94, multilingual: 95, instructionFollowing: 92 },
    pricing: { input: 1.25, output: 5, tier: "standard" },
    benchmarks: [
      { name: "MMLU", score: 81.9, percentile: 95 },
      { name: "HumanEval", score: 84.1, percentile: 90 },
      { name: "GSM8K", score: 90.8, percentile: 96 },
      { name: "MATH", score: 58.4, percentile: 78 },
    ],
    latency: { avg: 280, p50: 240, p95: 480, p99: 720 },
    throughput: { tokensPerSecond: 165, requestsPerMinute: 3600 },
    contextWindow: 2000000,
    trainingCutoff: "2024-05",
    releaseDate: "2024-02-15",
    description: "Google's flagship with industry-leading context window and strong multimodal capabilities. Excellent for document processing.",
    strengths: ["Massive context window", "Multilingual", "Vision", "Fast inference"],
    weaknesses: ["Math benchmarks lag", "Less creative"],
    useCases: ["Document analysis", "Translation", "Video understanding", "Research"],
  },
  "llama-3.1-405b": {
    scores: { overall: 92, coding: 89, math: 88, reasoning: 91, vision: 82, multilingual: 87, instructionFollowing: 90 },
    pricing: { input: 0, output: 0, tier: "free" },
    benchmarks: [
      { name: "MMLU", score: 85.2, percentile: 97 },
      { name: "HumanEval", score: 89.0, percentile: 96 },
      { name: "GSM8K", score: 88.2, percentile: 94 },
      { name: "MATH", score: 73.8, percentile: 89 },
    ],
    latency: { avg: 520, p50: 450, p95: 850, p99: 1200 },
    throughput: { tokensPerSecond: 76, requestsPerMinute: 1500 },
    contextWindow: 128000,
    trainingCutoff: "2024-06",
    releaseDate: "2024-07-23",
    description: "Meta's largest open-weight model with impressive capabilities rivaling closed-source alternatives. Free to use.",
    strengths: ["Open source", "Large parameter count", "Free access", "Strong coding"],
    weaknesses: ["Slower inference", "Higher resource requirements"],
    useCases: ["Research", "Self-hosted apps", "Fine-tuning", "Cost-sensitive workloads"],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCapabilities(model: ModelCard): string[] {
  const tags = new Set<string>();
  if (model.type === "Router") tags.add("routing");
  if (model.useCases.some((useCase) => /code|debug/i.test(useCase))) tags.add("function-calling");
  if (model.useCases.some((useCase) => /problem|homework|q&a/i.test(useCase))) tags.add("chat");
  if (model.strengths.some((strength) => /code|debug/i.test(strength))) tags.add("tools");
  tags.add("text-generation");
  if (model.speed.toLowerCase() === "fast") tags.add("streaming");
  return Array.from(tags);
}

function getPriceTier(input: number | null, output: number | null): PriceTier {
  const price = input ?? output;
  if (price === null || !Number.isFinite(price)) return "unknown";
  if (price <= 0) return "free";
  if (price <= 1) return "budget";
  if (price <= 5) return "standard";
  if (price <= 20) return "premium";
  return "enterprise";
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPricePerMillion(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  if (value >= 100) return `$${Math.round(value).toLocaleString()}`;
  if (value >= 10) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ModelHubContent() {
  const MODEL_PANEL_TRANSITION_MS = 320;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeSetting();
  const isDark = theme === "dark";

  // Data
  const [allModels, setAllModels] = useState<ModelCard[]>(() =>
    buildModelHubCardsFromIds([])
  );
  const leaderboardEligibleModels = useMemo(
    () => allModels.filter((model) => !NEXUS_ROUTING_MODEL_IDS.has(model.id)),
    [allModels]
  );
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [listProviderFilter, setListProviderFilter] = useState("all");
  const [listCapabilityFilter, setListCapabilityFilter] = useState("all");
  const [listSort, setListSort] = useState<"name" | "provider" | "price">(
    "name"
  );
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState<"providers" | "capabilities" | "price" | null>(null);
  const [providerFilters, setProviderFilters] = useState<Set<string>>(new Set());
  const [capabilityFilters, setCapabilityFilters] = useState<Set<string>>(new Set());
  const [priceFilters, setPriceFilters] = useState<Set<string>>(new Set());
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [panelModelId, setPanelModelId] = useState<string | null>(null);
  const [isModelPanelVisible, setIsModelPanelVisible] = useState(false);
  const [selectionPulseId, setSelectionPulseId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<PdfAttachment[]>([]);
  
  // Preset save modal state
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetSubject, setPresetSubject] = useState("General");
  const [labPresets, setLabPresets] = useState<LabPreset[]>([]);

  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionPulseTimeoutRef = useRef<number | null>(null);
  const panelUnmountTimeoutRef = useRef<number | null>(null);
  const panelOpenRafRef = useRef<number | null>(null);

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

  const convexLeaderboardAllModels = useQuery(
    convexApi.leaderboardModels.list,
    {
      limit: 500,
      sort: "name",
      sortDir: "asc",
    }
  ) as ConvexLeaderboardModel[] | undefined;

  const convexLeaderboardListModels = useQuery(
    convexApi.leaderboardModels.list,
    {
      ...(listProviderFilter !== "all"
        ? { provider: listProviderFilter }
        : {}),
      ...(listCapabilityFilter !== "all"
        ? { capability: listCapabilityFilter }
        : {}),
      ...(listSearchQuery.trim()
        ? { search: listSearchQuery.trim() }
        : {}),
      limit: 250,
      sort: listSort,
      sortDir: listSortDir,
    }
  ) as ConvexLeaderboardModel[] | undefined;

  const convexLeaderboardFilters = useQuery(
    convexApi.leaderboardModels.filters,
    {}
  ) as ConvexLeaderboardFilters | undefined;

  const leaderboardByModelId = useMemo(() => {
    const map = new Map<string, ConvexLeaderboardModel>();
    (convexLeaderboardAllModels ?? []).forEach((model) => {
      map.set(model.modelId, model);
    });
    return map;
  }, [convexLeaderboardAllModels]);

  useEffect(() => {
    let isCancelled = false;
    const loadOpenRouterModels = async () => {
      try {
        const response = await fetch("/api/openrouter/models", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { modelIds?: unknown };
        const modelIds = Array.isArray(payload.modelIds)
          ? payload.modelIds.filter(
              (value): value is string =>
                typeof value === "string" && value.includes("/")
            )
          : [];
        if (isCancelled) return;
        setAllModels(buildModelHubCardsFromIds(modelIds));
      } catch {
        if (isCancelled) return;
        setAllModels(buildModelHubCardsFromIds([]));
      }
    };
    void loadOpenRouterModels();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Load data
  useEffect(() => {
    setHistoryEntries(loadHistory());
    setLabPresets(loadLabPresets());
    
    const handler = () => setLabPresets(loadLabPresets());
    window.addEventListener("lab-presets-updated", handler);

    return () => {
      window.removeEventListener("lab-presets-updated", handler);
    };
  }, []);

  // Handle URL params
  useEffect(() => {
    const stackParam = searchParams.get("stack");
    if (stackParam) {
      const ids = stackParam
        .split(",")
        .filter(Boolean)
        .filter((id) => !NEXUS_ROUTING_MODEL_IDS.has(id));
      setSelectedIds(new Set(ids));
    }
  }, [searchParams]);

  useEffect(() => {
    const allowed = new Set(
      allModels
        .map((model) => model.id)
        .filter((id) => !NEXUS_ROUTING_MODEL_IDS.has(id))
    );
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => allowed.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [allModels]);

  // Close filter panel on click outside
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current?.contains(e.target as Node)) return;
      setFilterOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  useEffect(() => {
    return () => {
      if (selectionPulseTimeoutRef.current !== null) {
        window.clearTimeout(selectionPulseTimeoutRef.current);
      }
      if (panelUnmountTimeoutRef.current !== null) {
        window.clearTimeout(panelUnmountTimeoutRef.current);
      }
      if (panelOpenRafRef.current !== null) {
        window.cancelAnimationFrame(panelOpenRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeModelId) {
      if (panelUnmountTimeoutRef.current !== null) {
        window.clearTimeout(panelUnmountTimeoutRef.current);
        panelUnmountTimeoutRef.current = null;
      }
      if (panelModelId === null) {
        // Ensure the panel mounts in an off-screen state, then animates in.
        setIsModelPanelVisible(false);
      } else {
        setIsModelPanelVisible(true);
      }
      setPanelModelId((current) => (current === activeModelId ? current : activeModelId));
      return;
    }
    if (!panelModelId) return;
    if (panelOpenRafRef.current !== null) {
      window.cancelAnimationFrame(panelOpenRafRef.current);
      panelOpenRafRef.current = null;
    }
    setIsModelPanelVisible(false);
    panelUnmountTimeoutRef.current = window.setTimeout(() => {
      setPanelModelId(null);
      panelUnmountTimeoutRef.current = null;
    }, MODEL_PANEL_TRANSITION_MS);
  }, [activeModelId, panelModelId, MODEL_PANEL_TRANSITION_MS]);

  useEffect(() => {
    if (!panelModelId) return;
    if (panelOpenRafRef.current !== null) {
      window.cancelAnimationFrame(panelOpenRafRef.current);
      panelOpenRafRef.current = null;
    }
    panelOpenRafRef.current = window.requestAnimationFrame(() => {
      setIsModelPanelVisible(true);
      panelOpenRafRef.current = null;
    });
    return () => {
      if (panelOpenRafRef.current !== null) {
        window.cancelAnimationFrame(panelOpenRafRef.current);
        panelOpenRafRef.current = null;
      }
    };
  }, [panelModelId]);

  useEffect(() => {
    if (!panelModelId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveModelId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelModelId]);

  const appendChatDictationText = useCallback((spokenText: string) => {
    setChatInput((current) => {
      const separator = current.trim().length === 0 || /\s$/.test(current) ? "" : " ";
      return `${current}${separator}${spokenText}`;
    });
  }, []);

  const {
    isSupported: supportsChatDictation,
    isListening: isChatDictating,
    toggle: toggleChatDictation,
    stop: stopChatDictation,
  } = useSpeechDictation({ onText: appendChatDictationText });

  useEffect(() => {
    if (isChatOpen) return;
    if (!isChatDictating) return;
    stopChatDictation();
  }, [isChatOpen, isChatDictating, stopChatDictation]);

  // Build detailed model data
  const getDetailedModel = (model: ModelCard, rank: number): DetailedModelData => {
    const enhanced = ENHANCED_MODEL_DATA[model.id] || {};
    const leaderboard = leaderboardByModelId.get(model.id);
    const promptPrice = leaderboard?.pricing?.prompt ?? null;
    const completionPrice = leaderboard?.pricing?.completion ?? null;

    return {
      id: model.id,
      rank,
      model,
      leaderboard,
      scores: {
        overall: null,
        coding: null,
        math: null,
        reasoning: null,
        vision: null,
        multilingual: null,
        instructionFollowing: null,
      },
      pricing: {
        input: promptPrice,
        output: completionPrice,
        tier: getPriceTier(promptPrice, completionPrice),
      },
      capabilities: leaderboard?.capabilities?.length
        ? leaderboard.capabilities
        : getCapabilities(model),
      benchmarks: Array.isArray(enhanced.benchmarks) ? enhanced.benchmarks : [],
      latency: enhanced.latency || { avg: 350, p50: 300, p95: 600, p99: 900 },
      throughput: enhanced.throughput || { tokensPerSecond: 100, requestsPerMinute: 2000 },
      contextWindow: leaderboard?.contextLength ?? enhanced.contextWindow ?? 128000,
      trainingCutoff: enhanced.trainingCutoff || "2024-01",
      releaseDate: enhanced.releaseDate || "2024-01-01",
      description: leaderboard?.description || enhanced.description || model.focus,
      strengths: enhanced.strengths || model.strengths,
      weaknesses: enhanced.weaknesses || ["Limited information available"],
      useCases: enhanced.useCases || model.useCases,
    };
  };

  // Filter and sort models
  const modelRows = useMemo(() => {
    let rows = leaderboardEligibleModels.map((model, index) => ({
      ...getDetailedModel(model, index + 1),
      isSelected: selectedIds.has(model.id),
    }));

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.model.name.toLowerCase().includes(query) ||
          row.model.provider.toLowerCase().includes(query) ||
          row.description.toLowerCase().includes(query) ||
          row.strengths.some((s) => s.toLowerCase().includes(query))
      );
    }

    // Apply provider filters
    if (providerFilters.size > 0) {
      rows = rows.filter((row) => providerFilters.has(row.model.provider));
    }

    // Apply capability filters
    if (capabilityFilters.size > 0) {
      rows = rows.filter((row) =>
        Array.from(capabilityFilters).every((cap) => row.capabilities.includes(cap))
      );
    }

    // Apply price filters
    if (priceFilters.size > 0) {
      rows = rows.filter((row) => priceFilters.has(row.pricing.tier));
    }

    // Sort
    rows.sort((a, b) => {
      const numberOrNull = (value: number | null) =>
        value !== null && Number.isFinite(value) ? value : null;

      const compareNullableNumber = (left: number | null, right: number | null) => {
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right;
      };

      let comparison = 0;
      if (sortKey === "name") {
        comparison = a.model.name.localeCompare(b.model.name);
      } else if (sortKey === "price") {
        const leftPrice = numberOrNull(a.pricing.input ?? a.pricing.output);
        const rightPrice = numberOrNull(b.pricing.input ?? b.pricing.output);
        comparison = compareNullableNumber(leftPrice, rightPrice);
      } else if (sortKey === "speed") {
        comparison = a.latency.avg - b.latency.avg;
      } else {
        const leftScore = numberOrNull(a.scores[sortKey]);
        const rightScore = numberOrNull(b.scores[sortKey]);
        comparison = compareNullableNumber(leftScore, rightScore);
      }
      return sortDir === "desc" ? -comparison : comparison;
    });

    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [
    leaderboardEligibleModels,
    leaderboardByModelId,
    searchQuery,
    providerFilters,
    capabilityFilters,
    priceFilters,
    sortKey,
    sortDir,
    selectedIds,
  ]);

  // Get unique values for filters
  const allProviders = useMemo(
    () => Array.from(new Set(leaderboardEligibleModels.map((m) => m.provider))).sort(),
    [leaderboardEligibleModels]
  );
  const allCapabilities = useMemo(
    () => Array.from(new Set(leaderboardEligibleModels.flatMap((m) => getCapabilities(m)))).sort(),
    [leaderboardEligibleModels]
  );
  const priceTiers: PriceTier[] = ["free", "budget", "standard", "premium", "enterprise", "unknown"];

  const convexListRows = convexLeaderboardListModels ?? [];
  const convexListFilters = convexLeaderboardFilters ?? {
    providers: [],
    capabilities: [],
    count: 0,
  };
  const isConvexListLoading =
    convexLeaderboardListModels === undefined || convexLeaderboardFilters === undefined;

  const activeFiltersCount = providerFilters.size + capabilityFilters.size + priceFilters.size;
  const activeModel = panelModelId ? modelRows.find((r) => r.id === panelModelId) : null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectionPulseId(id);
    if (selectionPulseTimeoutRef.current !== null) {
      window.clearTimeout(selectionPulseTimeoutRef.current);
    }
    selectionPulseTimeoutRef.current = window.setTimeout(() => {
      setSelectionPulseId((current) => (current === id ? null : current));
      selectionPulseTimeoutRef.current = null;
    }, 360);
  };

  const clearFilters = () => {
    setProviderFilters(new Set());
    setCapabilityFilters(new Set());
    setPriceFilters(new Set());
    setSearchQuery("");
  };

  const handleCompare = () => {
    if (selectedIds.size < 2) return;
    const stack = Array.from(selectedIds).join(",");
    router.push(`/studio?stack=${encodeURIComponent(stack)}`);
  };
  
  const handleSavePreset = () => {
    if (!presetName.trim() || selectedIds.size === 0) return;
    const preset: LabPreset = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      name: presetName.trim(),
      models: Array.from(selectedIds),
      subject: presetSubject,
      createdAt: new Date().toISOString(),
    };
    const nextPresets = upsertLabPreset(preset);
    setLabPresets(nextPresets);
    setPresetName("");
    setShowSavePreset(false);
  };

  const handleChatFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const newAttachments: PdfAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!isPdfFile(file)) continue;
      try {
        const attachment = await fileToAttachment(file);
        newAttachments.push(attachment);
      } catch {
        // Ignore failed attachments.
      }
    }
    if (newAttachments.length === 0) return;
    setChatAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleChatSend = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    if (isChatDictating) {
      stopChatDictation();
    }

    const attachmentSuffix =
      chatAttachments.length > 0
        ? `\n\nAttached PDFs: ${chatAttachments.map((attachment) => attachment.name).join(", ")}`
        : "";
    const prompt = `${trimmed}${attachmentSuffix}`;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
    };
    
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatAttachments([]);
    
    setTimeout(() => {
      const response = generateModelRecommendation(prompt, modelRows);
      setChatMessages((prev) => [...prev, response]);
    }, 1000);
  };

  const generateModelRecommendation = (query: string, models: DetailedModelData[]): ChatMessage => {
    const query_lower = query.toLowerCase();
    const hasScore = (value: number | null): value is number =>
      value !== null && Number.isFinite(value);
    
    let recommendations: Array<{ id: string; reason: string; confidence: number }> = [];
    
    if (query_lower.includes("code") || query_lower.includes("programming")) {
      recommendations = models
        .filter((m) => hasScore(m.scores.coding) && m.scores.coding > 85)
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          reason: `Strong coding performance (${formatScore(m.scores.coding)}/100) with ${m.capabilities.includes("function-calling") ? "function calling support" : "excellent code generation"}`,
          confidence: (m.scores.coding as number) / 100,
        }));
    } else if (query_lower.includes("cheap") || query_lower.includes("budget")) {
      recommendations = models
        .filter((m) => m.pricing.tier === "free" || m.pricing.tier === "budget")
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          reason: `${m.pricing.tier === "free" ? "Free" : "Budget-friendly"} pricing at ${formatPricePerMillion(m.pricing.input ?? m.pricing.output ?? undefined)}/1M tokens`,
          confidence: 0.9,
        }));
    } else if (query_lower.includes("fast") || query_lower.includes("quick")) {
      recommendations = models
        .filter((m) => m.latency.avg < 350)
        .sort((a, b) => a.latency.avg - b.latency.avg)
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          reason: `Fast inference at ${formatLatency(m.latency.avg)} average latency`,
          confidence: 0.85,
        }));
    } else {
      recommendations = models
        .filter((m) => hasScore(m.scores.overall))
        .sort((a, b) => (b.scores.overall as number) - (a.scores.overall as number))
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          reason: `Top overall performance (${formatScore(m.scores.overall)}/100) with ${m.strengths[0]}`,
          confidence: (m.scores.overall as number) / 100,
        }));
    }
    
    return {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Based on your needs, I recommend these models:`,
      recommendations,
    };
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={14} color={colors.textSecondary} />;
    return sortDir === "desc" ? (
      <ChevronDown size={14} color={colors.accent} />
    ) : (
      <ChevronUp size={14} color={colors.accent} />
    );
  };

  const getTierColor = (tier: PriceTier) => {
    const tierColors: Record<PriceTier, string> = {
      free: "#22C55E",
      budget: "#10B981",
      standard: "#F59E0B",
      premium: "#EF4444",
      enterprise: "#8B5CF6",
      unknown: colors.textMuted,
    };
    return tierColors[tier];
  };

  const cardTransitionStyle = {
    transition:
      "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, background-color 220ms ease",
    willChange: "transform, box-shadow, background-color",
  } as const;

  const buttonTransitionStyle = {
    transition:
      "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, background-color 220ms ease",
    willChange: "transform, box-shadow, background-color",
  } as const;

  return (
    <YStack flex={1} backgroundColor={colors.bg} minHeight="100vh">
      <Header />

      <XStack flex={1} overflow="hidden">
        {/* Left Sidebar - Collapsible Chat */}
        <YStack
          width={isChatOpen ? 360 : 0}
          minWidth={isChatOpen ? 360 : 0}
          opacity={isChatOpen ? 1 : 0}
          pointerEvents={isChatOpen ? "auto" : "none"}
          backgroundColor={colors.bgSecondary}
          borderRightWidth={1}
          borderColor={colors.border}
          overflow="hidden"
          style={{
            transition:
              "width 320ms cubic-bezier(0.22, 1, 0.36, 1), min-width 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: isChatOpen ? "translateX(0)" : "translateX(-20px)",
          }}
        >
            {/* Chat Header */}
            <XStack
              padding="$md"
              borderBottomWidth={1}
              borderColor={colors.border}
              justifyContent="space-between"
              alignItems="center"
            >
              <XStack alignItems="center" gap="$xs">
                <Bot size={20} color={colors.accent} />
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Model Assistant
                </Text>
              </XStack>
              <Button
                size="$2"
                backgroundColor="transparent"
                borderWidth={0}
                color={colors.textMuted}
                onPress={() => setIsChatOpen(false)}
                animation="fast"
                pressStyle={{ scale: 0.94 }}
                hoverStyle={{ scale: 1.03 }}
                style={buttonTransitionStyle}
                icon={<X size={18} />}
              />
            </XStack>

            {/* Chat Mode Selector */}
            <XStack padding="$sm" gap="$xs">
              <Button
                flex={1}
                size="$2"
                backgroundColor={chatMode === "discover" ? colors.accent : colors.bgTertiary}
                color={chatMode === "discover" ? "black" : colors.text}
                borderRadius="$md"
                onPress={() => setChatMode("discover")}
                icon={<Sparkles size={14} />}
                animation="fast"
                pressStyle={{ scale: 0.97 }}
                hoverStyle={{ scale: 1.01 }}
                style={buttonTransitionStyle}
              >
                Find Model
              </Button>
              <Button
                flex={1}
                size="$2"
                backgroundColor={chatMode === "compare" ? colors.accent : colors.bgTertiary}
                color={chatMode === "compare" ? "black" : colors.text}
                borderRadius="$md"
                onPress={() => setChatMode("compare")}
                icon={<Layers size={14} />}
                animation="fast"
                pressStyle={{ scale: 0.97 }}
                hoverStyle={{ scale: 1.01 }}
                style={buttonTransitionStyle}
              >
                Compare
              </Button>
            </XStack>

            {/* Chat Messages */}
            <YStack flex={1} padding="$md" gap="$md" overflow="scroll">
              {chatMessages.length === 0 && (
                <YStack gap="$md" alignItems="center" padding="$xl">
                  <Sparkles size={48} color={colors.border} />
                  <Text fontSize={14} color={colors.textMuted} textAlign="center">
                    {chatMode === "compare"
                      ? "Select models from the leaderboard, then ask me to compare them."
                      : "Describe what you need, and I'll recommend the best models for you."}
                  </Text>
                  <YStack gap="$xs" width="100%">
                    {[
                      "What's the best model for coding?",
                      "Find me a fast, cheap model",
                      "Compare GPT-4o and Claude",
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        size="$2"
                        backgroundColor={colors.bgTertiary}
                        color={colors.textMuted}
                        borderWidth={1}
                        borderColor={colors.border}
                        onPress={() => {
                          setChatInput(suggestion);
                          setTimeout(handleChatSend, 100);
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </YStack>
                </YStack>
              )}

              {chatMessages.map((msg) => (
                <YStack
                  key={msg.id}
                  alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
                  maxWidth="85%"
                  backgroundColor={msg.role === "user" ? colors.accent : colors.bgTertiary}
                  padding="$md"
                  borderRadius="$lg"
                  borderBottomRightRadius={msg.role === "user" ? 4 : undefined}
                  borderBottomLeftRadius={msg.role === "assistant" ? 4 : undefined}
                >
                  <Text fontSize={14} color={msg.role === "user" ? "black" : colors.text}>
                    {msg.content}
                  </Text>
                  
                  {msg.recommendations && (
                    <YStack gap="$sm" marginTop="$sm">
                      {msg.recommendations.map((rec) => {
                        const model = modelRows.find((m) => m.id === rec.id);
                        if (!model) return null;
                        return (
                          <Button
                            key={rec.id}
                            size="$2"
                            backgroundColor={colors.bgSecondary}
                            borderWidth={1}
                            borderColor={colors.border}
                            borderRadius="$md"
                            onPress={() => setActiveModelId(rec.id)}
                            justifyContent="flex-start"
                            animation="fast"
                            pressStyle={{ scale: 0.98 }}
                            hoverStyle={{ y: -1 }}
                            style={buttonTransitionStyle}
                          >
                            <YStack alignItems="flex-start" gap="$xs">
                              <XStack alignItems="center" gap="$xs">
                                <Text fontSize={13} fontWeight="600" color={colors.text}>
                                  {model.model.name}
                                </Text>
                                <Text fontSize={11} color={colors.accent}>
                                  {Math.round(rec.confidence * 100)}% match
                                </Text>
                              </XStack>
                              <Text fontSize={12} color={colors.textMuted} numberOfLines={2}>
                                {rec.reason}
                              </Text>
                            </YStack>
                          </Button>
                        );
                      })}
                    </YStack>
                  )}
                </YStack>
              ))}
            </YStack>

            {/* Chat Input */}
            <YStack padding="$md" borderTopWidth={1} borderColor={colors.border} gap="$sm">
              <input
                ref={chatFileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={(event) => {
                  handleChatFilesSelected(event.target.files);
                  event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
              />

              {chatAttachments.length > 0 && (
                <XStack flexWrap="wrap" gap="$xs">
                  {chatAttachments.map((attachment, index) => (
                    <XStack
                      key={`${attachment.name}-${index}`}
                      alignItems="center"
                      gap="$xs"
                      borderWidth={1}
                      borderColor={colors.border}
                      borderRadius="$full"
                      paddingHorizontal="$sm"
                      paddingVertical="$xs"
                      backgroundColor={colors.bgTertiary}
                    >
                      <Text fontSize={11} color={colors.textMuted} numberOfLines={1} maxWidth={160}>
                        {attachment.name}
                      </Text>
                      <Button
                        size="$1"
                        backgroundColor="transparent"
                        borderWidth={0}
                        color={colors.textMuted}
                        padding={0}
                        onPress={() =>
                          setChatAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                        }
                        icon={<X size={12} />}
                      />
                    </XStack>
                  ))}
                </XStack>
              )}

              <XStack alignItems="flex-end" gap="$sm">
                <XStack gap="$xs">
                  <Button
                    size="$3"
                    backgroundColor={colors.bgTertiary}
                    borderWidth={1}
                    borderColor={colors.border}
                    color={colors.textMuted}
                    borderRadius="$md"
                    onPress={() => chatFileInputRef.current?.click()}
                    animation="fast"
                    pressStyle={{ scale: 0.94 }}
                    hoverStyle={{ scale: 1.02 }}
                    style={buttonTransitionStyle}
                    icon={<Paperclip size={16} />}
                  />
                  <Button
                    size="$3"
                    backgroundColor={isChatDictating ? colors.accentBg : colors.bgTertiary}
                    borderWidth={1}
                    borderColor={isChatDictating ? colors.accent : colors.border}
                    color={isChatDictating ? colors.accent : colors.textMuted}
                    borderRadius="$md"
                    onPress={toggleChatDictation}
                    disabled={!supportsChatDictation}
                    opacity={supportsChatDictation ? 1 : 0.5}
                    animation="fast"
                    pressStyle={{ scale: 0.94 }}
                    hoverStyle={{ scale: supportsChatDictation ? 1.02 : 1 }}
                    style={buttonTransitionStyle}
                    icon={isChatDictating ? <MicOff size={16} /> : <Mic size={16} />}
                  />
                </XStack>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="Ask about models..."
                  style={{
                    flex: 1,
                    backgroundColor: colors.bgTertiary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: 12,
                    color: colors.text,
                    fontSize: 14,
                    resize: "none",
                    minHeight: 44,
                    maxHeight: 120,
                    fontFamily: "inherit",
                  }}
                />
                <Button
                  size="$3"
                  backgroundColor={colors.accent}
                  color="black"
                  borderRadius="$md"
                  onPress={handleChatSend}
                  disabled={!chatInput.trim()}
                  animation="fast"
                  pressStyle={{ scale: 0.96 }}
                  hoverStyle={{ scale: chatInput.trim() ? 1.02 : 1 }}
                  style={{
                    ...buttonTransitionStyle,
                    boxShadow: isDark
                      ? "0 8px 18px rgba(34, 197, 94, 0.28)"
                      : "0 8px 18px rgba(34, 197, 94, 0.18)",
                  }}
                  icon={<Send size={18} />}
                />
              </XStack>
            </YStack>
          </YStack>

        {/* Chat Toggle Button */}
        <YStack
          position="absolute"
          left={0}
          top={80}
          zIndex={100}
          opacity={isChatOpen ? 0 : 1}
          pointerEvents={isChatOpen ? "none" : "auto"}
          style={{
            transition: "opacity 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: isChatOpen ? "translateX(-24px)" : "translateX(0)",
          }}
        >
          <Button
            size="$3"
            backgroundColor={colors.accent}
            color="black"
            borderTopLeftRadius={0}
            borderBottomLeftRadius={0}
            borderTopRightRadius="$md"
            borderBottomRightRadius="$md"
            onPress={() => setIsChatOpen(true)}
            icon={<ChevronRight size={20} />}
            animation="medium"
            pressStyle={{ scale: 0.95 }}
            hoverStyle={{ scale: 1.03, x: 2 }}
            style={{
              ...buttonTransitionStyle,
              boxShadow: isDark
                ? "0 10px 24px rgba(34, 197, 94, 0.32)"
                : "0 10px 24px rgba(34, 197, 94, 0.22)",
            }}
          >
            <YStack alignItems="flex-start">
              <Text fontSize={12} fontWeight="600" color="black">
                Model Assistant
              </Text>
              <Text fontSize={10} color="rgba(0,0,0,0.6)">
                Find & Compare
              </Text>
            </YStack>
          </Button>
        </YStack>

        {/* Main Content */}
        <YStack flex={1} padding="$lg" maxWidth={1400} marginHorizontal="auto">
          {/* Header */}
          <YStack gap="$xs" marginBottom="$lg">
            <XStack alignItems="center" gap="$sm" justifyContent="space-between">
              <XStack alignItems="center" gap="$sm">
                <Trophy size={28} color={colors.gold} />
                <H1 fontSize={32} fontWeight="800" color={colors.text}>
                  Model Leaderboard
                </H1>
              </XStack>
            </XStack>
            <Paragraph color={colors.textMuted} fontSize={15} maxWidth={600}>
              Compare AI models across coding, math, and reasoning benchmarks. Click any model for detailed insights.
            </Paragraph>
          </YStack>

          <YStack
            marginBottom="$lg"
            padding="$md"
            borderWidth={1}
            borderColor={colors.border}
            borderRadius="$lg"
            backgroundColor={colors.bgTertiary}
            gap="$md"
          >
            <XStack
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap="$sm"
            >
              <YStack>
                <Text fontSize={16} fontWeight="700" color={colors.text}>
                  List View (OpenRouter via Convex)
                </Text>
                <Text fontSize={12} color={colors.textMuted}>
                  Server-ingested model metadata with provider and capability filters.
                </Text>
              </YStack>
              <Text fontSize={12} color={colors.textMuted}>
                {`${convexListFilters.count} models`}
              </Text>
            </XStack>

            <XStack gap="$sm" flexWrap="wrap" alignItems="center">
              <XStack
                flex={1}
                minWidth={220}
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                backgroundColor={colors.bgSecondary}
                borderRadius="$md"
                borderWidth={1}
                borderColor={colors.border}
              >
                <Search size={16} color={colors.textMuted} />
                <Input
                  flex={1}
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={colors.text}
                  placeholder="Search name or provider"
                  placeholderTextColor={colors.textSecondary}
                  fontSize={14}
                  value={listSearchQuery}
                  onChangeText={setListSearchQuery}
                />
              </XStack>

              <YStack
                minWidth={160}
                borderWidth={1}
                borderColor={colors.border}
                borderRadius="$md"
                backgroundColor={colors.bgSecondary}
                paddingHorizontal="$sm"
              >
                <select
                  value={listProviderFilter}
                  onChange={(event) => setListProviderFilter(event.currentTarget.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: colors.text,
                    fontSize: 13,
                    padding: "9px 0",
                  }}
                >
                  <option value="all">All providers</option>
                  {convexListFilters.providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </YStack>

              <YStack
                minWidth={170}
                borderWidth={1}
                borderColor={colors.border}
                borderRadius="$md"
                backgroundColor={colors.bgSecondary}
                paddingHorizontal="$sm"
              >
                <select
                  value={listCapabilityFilter}
                  onChange={(event) => setListCapabilityFilter(event.currentTarget.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: colors.text,
                    fontSize: 13,
                    padding: "9px 0",
                  }}
                >
                  <option value="all">All capabilities</option>
                  {convexListFilters.capabilities.map((capability) => (
                    <option key={capability} value={capability}>
                      {capability}
                    </option>
                  ))}
                </select>
              </YStack>

              <YStack
                minWidth={130}
                borderWidth={1}
                borderColor={colors.border}
                borderRadius="$md"
                backgroundColor={colors.bgSecondary}
                paddingHorizontal="$sm"
              >
                <select
                  value={listSort}
                  onChange={(event) =>
                    setListSort(
                      event.currentTarget.value as "name" | "provider" | "price"
                    )
                  }
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: colors.text,
                    fontSize: 13,
                    padding: "9px 0",
                  }}
                >
                  <option value="name">Sort: Name</option>
                  <option value="provider">Sort: Provider</option>
                  <option value="price">Sort: Price</option>
                </select>
              </YStack>

              <Button
                size="$3"
                backgroundColor={colors.bgSecondary}
                borderWidth={1}
                borderColor={colors.border}
                color={colors.text}
                borderRadius="$md"
                onPress={() =>
                  setListSortDir((current) => (current === "asc" ? "desc" : "asc"))
                }
              >
                {listSortDir === "asc" ? "Asc" : "Desc"}
              </Button>

              <Button
                size="$3"
                backgroundColor="transparent"
                borderWidth={1}
                borderColor={colors.border}
                color={colors.textMuted}
                borderRadius="$md"
                onPress={() => {
                  setListSearchQuery("");
                  setListProviderFilter("all");
                  setListCapabilityFilter("all");
                  setListSort("name");
                  setListSortDir("asc");
                }}
              >
                Reset
              </Button>
            </XStack>

            <YStack
              borderWidth={1}
              borderColor={colors.border}
              borderRadius="$md"
              overflow="hidden"
              backgroundColor={colors.bgSecondary}
            >
              <XStack
                padding="$sm"
                borderBottomWidth={1}
                borderColor={colors.border}
                backgroundColor={colors.bg}
                gap="$sm"
                alignItems="center"
              >
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={2}>
                  Model
                </Text>
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={1}>
                  Prompt Price
                </Text>
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={1}>
                  Completion Price
                </Text>
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={1}>
                  Context
                </Text>
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={1}>
                  Scores
                </Text>
                <Text fontSize={12} fontWeight="700" color={colors.textMuted} flex={2}>
                  Capabilities
                </Text>
              </XStack>

              <YStack maxHeight={420} overflow="scroll">
                {isConvexListLoading ? (
                  <YStack padding="$md">
                    <Text fontSize={13} color={colors.textMuted}>
                      Loading leaderboard models...
                    </Text>
                  </YStack>
                ) : convexListRows.length === 0 ? (
                  <YStack padding="$md">
                    <Text fontSize={13} color={colors.textMuted}>
                      No models matched the current filters.
                    </Text>
                  </YStack>
                ) : (
                  convexListRows.map((row) => (
                    <XStack
                      key={row.id}
                      padding="$sm"
                      borderBottomWidth={1}
                      borderColor={colors.border}
                      gap="$sm"
                      alignItems="center"
                    >
                      <YStack flex={2}>
                        <Text fontSize={14} fontWeight="600" color={colors.text}>
                          {row.name}
                        </Text>
                        <Text fontSize={12} color={colors.textMuted}>
                          {`${getProviderIcon(row.provider)} ${row.provider}`}
                        </Text>
                      </YStack>
                      <Text fontSize={13} color={colors.text} flex={1}>
                        {formatPricePerMillion(row.pricing?.prompt)}
                      </Text>
                      <Text fontSize={13} color={colors.text} flex={1}>
                        {formatPricePerMillion(row.pricing?.completion)}
                      </Text>
                      <Text fontSize={13} color={colors.text} flex={1}>
                        {typeof row.contextLength === "number"
                          ? `${formatNumber(row.contextLength)}`
                          : "—"}
                      </Text>
                      <Text fontSize={13} color={colors.textMuted} flex={1}>
                        —
                      </Text>
                      <XStack gap="$xs" flex={2} flexWrap="wrap">
                        {row.capabilities.length > 0 ? (
                          row.capabilities.map((capability) => (
                            <Text
                              key={`${row.id}-${capability}`}
                              fontSize={11}
                              color={colors.accent}
                              backgroundColor={colors.accentBg}
                              borderRadius="$full"
                              paddingHorizontal="$sm"
                              paddingVertical={4}
                            >
                              {capability}
                            </Text>
                          ))
                        ) : (
                          <Text fontSize={12} color={colors.textMuted}>
                            —
                          </Text>
                        )}
                      </XStack>
                    </XStack>
                  ))
                )}
              </YStack>
            </YStack>
          </YStack>

          {/* Selected Models Bar */}
          {selectedIds.size > 0 && (
            <XStack
              marginBottom="$md"
              padding="$md"
              backgroundColor={colors.accentBg}
              borderRadius="$md"
              borderWidth={1}
              borderColor={colors.accent}
              flexWrap="wrap"
              gap="$sm"
              alignItems="center"
            >
              <Text fontSize={14} fontWeight="600" color={colors.accent}>
                Selected Models:
              </Text>
              {Array.from(selectedIds).map((id) => {
                const model = leaderboardEligibleModels.find((m) => m.id === id);
                if (!model) return null;
                return (
                  <XStack
                    key={id}
                    alignItems="center"
                    gap="$xs"
                    paddingHorizontal="$sm"
                    paddingVertical="$xs"
                    backgroundColor={isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)"}
                    borderRadius="$full"
                  >
                    <Text fontSize={14} color={getProviderIcon(model.provider)}>
                      {getProviderIcon(model.provider)}
                    </Text>
                    <Text fontSize={13} fontWeight="500" color={colors.text}>
                      {model.name}
                    </Text>
                    <Button
                      size="$1"
                      backgroundColor="transparent"
                      borderWidth={0}
                      padding={0}
                      onPress={() => toggleSelection(id)}
                      icon={<X size={14} color={colors.textMuted} />}
                    />
                  </XStack>
                );
              })}
              <Button
                size="$2"
                backgroundColor="transparent"
                borderWidth={0}
                color={colors.red}
                onPress={() => setSelectedIds(new Set())}
              >
                Clear all
              </Button>
            </XStack>
          )}

          {/* Controls */}
          <XStack
            gap="$md"
            marginBottom="$lg"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack gap="$sm" flex={1} minWidth={280}>
              <XStack
                flex={1}
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                backgroundColor={colors.bgTertiary}
                borderRadius="$md"
                borderWidth={1}
                borderColor={colors.border}
              >
                <Search size={18} color={colors.textMuted} />
                <Input
                  flex={1}
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={colors.text}
                  placeholder="Search models..."
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

              {/* Filter Dropdown */}
              <YStack position="relative">
                <Button
                  size="$3"
                  backgroundColor={filterOpen ? colors.text : colors.bgTertiary}
                  color={filterOpen ? colors.bg : colors.text}
                  borderWidth={1}
                  borderColor={activeFiltersCount > 0 ? colors.accent : colors.border}
                  borderRadius="$md"
                  onPress={() => setFilterOpen(filterOpen ? null : "providers")}
                  icon={<Filter size={16} />}
                >
                  {`Filters ${activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}`}
                </Button>

                {filterOpen && (
                  <YStack
                    ref={filterPanelRef}
                    position="absolute"
                    top="$lg"
                    left={0}
                    zIndex={50}
                    width={340}
                    maxHeight={500}
                    backgroundColor={colors.bgSecondary}
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor={colors.border}
                    padding="$md"
                    gap="$lg"
                    overflow="scroll"
                  >
                    {/* Provider Filter */}
                    <YStack gap="$xs">
                      <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                        Providers
                      </Text>
                      <XStack flexWrap="wrap" gap="$xs">
                        {allProviders.map((provider) => (
                          <Button
                            key={provider}
                            size="$2"
                            backgroundColor={providerFilters.has(provider) ? colors.accent : colors.bgTertiary}
                            color={providerFilters.has(provider) ? "black" : colors.text}
                            borderRadius="$full"
                            onPress={() => {
                              setProviderFilters((prev) => {
                                const next = new Set(prev);
                                if (next.has(provider)) next.delete(provider);
                                else next.add(provider);
                                return next;
                              });
                            }}
                          >
                            {provider}
                          </Button>
                        ))}
                      </XStack>
                    </YStack>

                    {/* Price Tier Filter */}
                    <YStack gap="$xs">
                      <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                        Price Tier
                      </Text>
                      <XStack flexWrap="wrap" gap="$xs">
                        {priceTiers.map((tier) => (
                          <Button
                            key={tier}
                            size="$2"
                            backgroundColor={priceFilters.has(tier) ? getTierColor(tier) : colors.bgTertiary}
                            color={priceFilters.has(tier) ? "black" : colors.text}
                            borderRadius="$full"
                            onPress={() => {
                              setPriceFilters((prev) => {
                                const next = new Set(prev);
                                if (next.has(tier)) next.delete(tier);
                                else next.add(tier);
                                return next;
                              });
                            }}
                          >
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          </Button>
                        ))}
                      </XStack>
                    </YStack>

                    {/* Capability Filter */}
                    <YStack gap="$xs">
                      <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                        Capabilities
                      </Text>
                      <XStack flexWrap="wrap" gap="$xs">
                        {allCapabilities.map((cap) => (
                          <Button
                            key={cap}
                            size="$2"
                            backgroundColor={capabilityFilters.has(cap) ? colors.accent : colors.bgTertiary}
                            color={capabilityFilters.has(cap) ? "black" : colors.text}
                            borderRadius="$full"
                            onPress={() => {
                              setCapabilityFilters((prev) => {
                                const next = new Set(prev);
                                if (next.has(cap)) next.delete(cap);
                                else next.add(cap);
                                return next;
                              });
                            }}
                          >
                            {cap}
                          </Button>
                        ))}
                      </XStack>
                    </YStack>

                    {activeFiltersCount > 0 && (
                      <Button
                        size="$2"
                        backgroundColor="transparent"
                        borderWidth={0}
                        color={colors.textMuted}
                        onPress={clearFilters}
                      >
                        Clear all filters
                      </Button>
                    )}
                  </YStack>
                )}
              </YStack>
            </XStack>

            {/* Compare & Save Buttons */}
            <XStack gap="$sm" alignItems="center">
              <Text fontSize={13} color={colors.textMuted}>
                {selectedIds.size} selected
              </Text>
              {selectedIds.size > 0 && (
                <Button
                  size="$3"
                  backgroundColor={colors.bgTertiary}
                  color={colors.text}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius="$md"
                  onPress={() => setShowSavePreset(true)}
                  icon={<Sparkles size={16} />}
                  animation="fast"
                  pressStyle={{ scale: 0.96 }}
                  hoverStyle={{ y: -1 }}
                  style={buttonTransitionStyle}
                >
                  Save Preset
                </Button>
              )}
              <Button
                size="$3"
                backgroundColor={selectedIds.size >= 2 ? colors.accent : colors.bgTertiary}
                color={selectedIds.size >= 2 ? "black" : colors.textMuted}
                borderRadius="$md"
                disabled={selectedIds.size < 2}
                onPress={handleCompare}
                icon={<Layers size={16} />}
                animation="fast"
                pressStyle={{ scale: selectedIds.size >= 2 ? 0.96 : 1 }}
                hoverStyle={{ y: selectedIds.size >= 2 ? -1 : 0 }}
                style={buttonTransitionStyle}
              >
                Compare in Studio
              </Button>
            </XStack>
          </XStack>

          {/* Leaderboard Table */}
          <YStack
            borderWidth={1}
            borderColor={colors.border}
            borderRadius="$lg"
            overflow="hidden"
            backgroundColor={colors.bgTertiary}
          >
            {/* Table Header */}
            <XStack
              padding="$md"
              backgroundColor={colors.bgSecondary}
              borderBottomWidth={1}
              borderColor={colors.border}
            >
              <XStack flex={1} alignItems="center" gap="$sm">
                <Text fontSize={12} fontWeight="600" color={colors.textMuted} minWidth={40}>
                  RANK
                </Text>
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={sortKey === "name" ? colors.text : colors.textMuted}
                  fontWeight={sortKey === "name" ? "600" : "400"}
                  onPress={() => toggleSort("name")}
                  icon={getSortIcon("name")}
                >
                  Model
                </Button>
              </XStack>

              <XStack flex={1} justifyContent="flex-end" gap="$sm">
                {[
                  { key: "overall", label: "Overall", icon: Trophy },
                  { key: "coding", label: "Coding", icon: Code2 },
                  { key: "math", label: "Math", icon: Calculator },
                  { key: "reasoning", label: "Reasoning", icon: Brain },
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={0}
                    color={sortKey === key ? colors.accent : colors.textMuted}
                    fontWeight={sortKey === key ? "600" : "400"}
                    onPress={() => toggleSort(key as SortKey)}
                    icon={<Icon size={14} color={sortKey === key ? colors.accent : colors.textMuted} />}
                  >
                    {label}
                  </Button>
                ))}

                <Button
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={sortKey === "price" ? colors.text : colors.textMuted}
                  fontWeight={sortKey === "price" ? "600" : "400"}
                  onPress={() => toggleSort("price")}
                  icon={getSortIcon("price")}
                  minWidth={60}
                >
                  Price
                </Button>
              </XStack>
            </XStack>

            {/* Table Rows */}
            <YStack maxHeight={600} overflow="scroll">
              {modelRows.map((row) => {
                const isSelectionPulsing = selectionPulseId === row.id;
                return (
                <XStack
                  key={row.id}
                  padding="$md"
                  backgroundColor={
                    isSelectionPulsing
                      ? isDark
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(34, 197, 94, 0.16)"
                      : row.isSelected
                        ? colors.accentBg
                        : "transparent"
                  }
                  borderBottomWidth={1}
                  borderColor={colors.border}
                  animation={isSelectionPulsing ? "medium" : "fast"}
                  hoverStyle={{
                    backgroundColor: row.isSelected ? colors.accentBg : colors.bgSecondary,
                    y: -1,
                  }}
                  pressStyle={{ scale: 0.998, y: 0 }}
                  style={{
                    ...cardTransitionStyle,
                    cursor: "pointer",
                    transform: isSelectionPulsing ? "translateY(-2px) scale(1.004)" : undefined,
                    boxShadow: isSelectionPulsing
                      ? isDark
                        ? "0 0 0 1px rgba(34, 197, 94, 0.56), 0 10px 24px rgba(34, 197, 94, 0.34)"
                        : "0 0 0 1px rgba(34, 197, 94, 0.42), 0 10px 20px rgba(34, 197, 94, 0.2)"
                      : row.isSelected
                        ? isDark
                          ? "0 6px 18px rgba(34, 197, 94, 0.24)"
                          : "0 6px 16px rgba(34, 197, 94, 0.14)"
                        : "none",
                  }}
                  onPress={() => setActiveModelId(row.id)}
                >
                  {/* Rank & Selection */}
                  <XStack flex={1} alignItems="center" gap="$md">
                    <XStack minWidth={40} alignItems="center" gap="$xs">
                      <Text fontSize={16} fontWeight="700" color={row.rank <= 3 ? colors.gold : colors.textMuted}>
                        {`#${row.rank}`}
                      </Text>
                      {row.rank <= 3 && <Trophy size={14} color={colors.gold} />}
                    </XStack>

                    <Button
                      size="$2"
                      backgroundColor={row.isSelected ? colors.accent : "transparent"}
                      borderWidth={1}
                      borderColor={row.isSelected ? colors.accent : colors.border}
                      borderRadius="$sm"
                      width={32}
                      height={32}
                      padding={0}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleSelection(row.id);
                      }}
                      animation="fast"
                      pressStyle={{ scale: 0.9 }}
                      hoverStyle={{
                        scale: 1.05,
                        borderColor: row.isSelected ? colors.accent : colors.textSecondary,
                      }}
                      style={{
                        ...buttonTransitionStyle,
                        transform: isSelectionPulsing ? "scale(1.08)" : undefined,
                        boxShadow: isSelectionPulsing
                          ? isDark
                            ? "0 6px 14px rgba(34, 197, 94, 0.34)"
                            : "0 6px 14px rgba(34, 197, 94, 0.2)"
                          : "none",
                      }}
                    >
                      {row.isSelected && <Check size={16} color="black" />}
                    </Button>

                    <YStack>
                      <XStack alignItems="center" gap="$xs">
                        <Text fontSize={14} color={colors.textMuted}>
                          {getProviderIcon(row.model.provider)}
                        </Text>
                        <Text fontSize={15} fontWeight="600" color={colors.text}>
                          {row.model.name}
                        </Text>
                        {row.model.type === "Router" && (
                          <Text 
                            fontSize={11} 
                            color={colors.accent} 
                            backgroundColor={isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)"}
                            paddingHorizontal="$xs" 
                            paddingVertical={2} 
                            borderRadius="$sm"
                          >
                            Router
                          </Text>
                        )}
                      </XStack>
                      <Text fontSize={12} color={colors.textSecondary}>
                        {`${row.model.provider} • ${row.model.speed} • ${row.capabilities.slice(0, 3).join(", ")}`}
                      </Text>
                    </YStack>
                  </XStack>

                  {/* Scores */}
                  <XStack flex={1} justifyContent="flex-end" gap="$sm" alignItems="center">
                    {[
                      row.scores.overall,
                      row.scores.coding,
                      row.scores.math,
                      row.scores.reasoning,
                    ].map((score, idx) => {
                      const hasScore = score !== null && Number.isFinite(score);
                      const scoreColor = hasScore && score >= 90 ? colors.accent : colors.textMuted;
                      return (
                        <YStack key={idx} minWidth={70} alignItems="center">
                          <Text fontSize={15} fontWeight="700" color={scoreColor}>
                            {formatScore(score)}
                          </Text>
                          <YStack
                            height={4}
                            width={40}
                            backgroundColor={colors.border}
                            borderRadius="$full"
                            overflow="hidden"
                          >
                            <YStack
                              height="100%"
                              width={hasScore ? `${score}%` : "0%"}
                              backgroundColor={scoreColor}
                            />
                          </YStack>
                        </YStack>
                      );
                    })}

                    <YStack minWidth={60} alignItems="center">
                      <Text 
                        fontSize={14} 
                        color={getTierColor(row.pricing.tier)}
                        fontWeight="500"
                      >
                        {formatPricePerMillion(row.pricing.input ?? undefined)}
                      </Text>
                    </YStack>
                  </XStack>
                </XStack>
              )})}
            </YStack>

            {modelRows.length === 0 && (
              <YStack padding="$xl" alignItems="center" gap="$md">
                <Search size={48} color={colors.border} />
                <Text fontSize={16} color={colors.textMuted}>
                  No models match your filters
                </Text>
                <Button
                  size="$3"
                  backgroundColor={colors.bgTertiary}
                  color={colors.text}
                  onPress={clearFilters}
                >
                  Clear filters
                </Button>
              </YStack>
            )}
          </YStack>

          {/* Footer Info */}
          <XStack
            marginTop="$lg"
            justifyContent="space-between"
            alignItems="flex-start"
            flexWrap="wrap"
            gap="$sm"
          >
            <YStack gap="$xs" flex={1} minWidth={260} maxWidth={520}>
              <XStack alignItems="center" gap="$xs">
                <Info size={14} color={colors.textMuted} />
                <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                  About Scores
                </Text>
              </XStack>
              <Text fontSize={12} color={colors.textSecondary} lineHeight={18}>
                Benchmark scores are only shown when trusted benchmark data is available. Missing values are shown as "—" instead of synthetic estimates.
              </Text>
            </YStack>

            <Text fontSize={12} color={colors.textSecondary} marginLeft="auto" flexShrink={0}>
              {`Showing ${modelRows.length} of ${leaderboardEligibleModels.length} models`}
            </Text>
          </XStack>
        </YStack>

        {/* Right Slide-out: Model Detail Panel */}
        {/* Save Preset Modal */}
        {showSavePreset && (
          <>
            {/* Backdrop */}
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.4)",
                zIndex: 200,
              }}
              onClick={() => setShowSavePreset(false)}
            />
            
            {/* Modal */}
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 400,
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                zIndex: 201,
                padding: 24,
              }}
            >
              <YStack gap="$md">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={18} fontWeight="600" color={colors.text}>
                    Save Model Preset
                  </Text>
                  <Button
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={0}
                    onPress={() => setShowSavePreset(false)}
                    icon={<X size={18} color={colors.textMuted} />}
                  />
                </XStack>
                
                <Text fontSize={13} color={colors.textMuted}>
                  Save {selectedIds.size} model{selectedIds.size > 1 ? "s" : ""} as a preset for quick access in Studio.
                </Text>
                
                <YStack gap="$xs">
                  <Text fontSize={12} color={colors.textMuted}>Preset Name</Text>
                  <Input
                    value={presetName}
                    onChangeText={setPresetName}
                    placeholder="e.g., Coding Stack, Research Team..."
                    borderColor={colors.border}
                    backgroundColor={colors.bg}
                    color={colors.text}
                    placeholderTextColor={colors.textSecondary}
                    fontSize={14}
                  />
                </YStack>
                
                <YStack gap="$xs">
                  <Text fontSize={12} color={colors.textMuted}>Subject</Text>
                  <XStack gap="$xs" flexWrap="wrap">
                    {["General", "Mathematics", "Physics", "Computer Science", "Writing", "History", "Business", "Creative"].map((subject) => {
                      const isActive = presetSubject === subject;
                      return (
                        <Button
                          key={subject}
                          size="$2"
                          backgroundColor={isActive ? colors.accent : colors.bgTertiary}
                          color={isActive ? "black" : colors.text}
                          borderWidth={1}
                          borderColor={isActive ? colors.accent : colors.border}
                          borderRadius="$full"
                          onPress={() => setPresetSubject(subject)}
                        >
                          {subject}
                        </Button>
                      );
                    })}
                  </XStack>
                </YStack>
                
                <XStack gap="$sm" marginTop="$sm">
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor={colors.border}
                    color={colors.text}
                    onPress={() => setShowSavePreset(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor={colors.accent}
                    color="black"
                    onPress={handleSavePreset}
                    disabled={!presetName.trim()}
                  >
                    Save Preset
                  </Button>
                </XStack>
              </YStack>
            </div>
          </>
        )}

        {panelModelId && activeModel && (
          <>
            {/* Backdrop */}
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.4)",
                zIndex: 100,
                opacity: isModelPanelVisible ? 1 : 0,
                transition: "opacity 220ms ease",
                pointerEvents: isModelPanelVisible ? "auto" : "none",
              }}
              onClick={() => setActiveModelId(null)}
            />
            
            {/* Panel */}
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: 480,
                backgroundColor: colors.bgSecondary,
                borderLeft: `1px solid ${colors.border}`,
                zIndex: 101,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                transform: isModelPanelVisible ? "translateX(0)" : "translateX(100%)",
                opacity: isModelPanelVisible ? 1 : 0.96,
                transition: `transform ${MODEL_PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease`,
                willChange: "transform, opacity",
              }}
            >
              {/* Panel Header */}
              <XStack
                padding="$lg"
                borderBottomWidth={1}
                borderColor={colors.border}
                justifyContent="space-between"
                alignItems="flex-start"
                backgroundColor={colors.bgTertiary}
              >
                <YStack gap="$xs" flex={1}>
                  <XStack alignItems="center" gap="$sm">
                    <Text fontSize={24} color={colors.textMuted}>
                      {getProviderIcon(activeModel.model.provider)}
                    </Text>
                    <Text fontSize={24} fontWeight="700" color={colors.text}>
                      {activeModel.model.name}
                    </Text>
                  </XStack>
                  <XStack alignItems="center" gap="$sm">
                    <Text fontSize={14} color={colors.textMuted}>
                      {activeModel.model.provider}
                    </Text>
                    <Text fontSize={12} color={colors.textSecondary}>
                      {`• Released ${activeModel.releaseDate}`}
                    </Text>
                  </XStack>
                </YStack>
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  borderWidth={0}
                  color={colors.textMuted}
                  onPress={() => setActiveModelId(null)}
                  icon={<X size={24} />}
                />
              </XStack>

              <YStack padding="$lg" gap="$xl">
                {/* Description */}
                <Text fontSize={15} color={colors.textMuted} lineHeight={1.6}>
                  {activeModel.description}
                </Text>

                {/* Overall Score Card */}
                <YStack
                  backgroundColor={colors.bgTertiary}
                  borderRadius="$lg"
                  padding="$lg"
                  borderWidth={1}
                  borderColor={colors.border}
                >
                  <XStack alignItems="center" gap="$sm" marginBottom="$md">
                    <Award size={20} color={colors.gold} />
                    <Text fontSize={16} fontWeight="600" color={colors.text}>
                      Performance Scores
                    </Text>
                  </XStack>
                  
                  <XStack gap="$lg" flexWrap="wrap">
                    {Object.entries(activeModel.scores).map(([key, score]) => {
                      const hasScore = score !== null && Number.isFinite(score);
                      const scoreColor = hasScore
                        ? score >= 90
                          ? colors.accent
                          : score >= 80
                            ? colors.gold
                            : colors.textMuted
                        : colors.textMuted;
                      return (
                        <YStack key={key} alignItems="center" gap="$xs" minWidth={80}>
                          <Text fontSize={28} fontWeight="800" color={scoreColor}>
                            {formatScore(score)}
                          </Text>
                          <Text fontSize={11} color={colors.textSecondary} textTransform="capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </Text>
                          <YStack
                            height={6}
                            width={60}
                            backgroundColor={colors.border}
                            borderRadius="$full"
                            overflow="hidden"
                          >
                            <YStack
                              height="100%"
                              width={hasScore ? `${score}%` : "0%"}
                              backgroundColor={scoreColor}
                            />
                          </YStack>
                        </YStack>
                      );
                    })}
                  </XStack>
                </YStack>

                {/* Pricing Section */}
                <YStack gap="$md">
                  <XStack alignItems="center" gap="$sm">
                    <DollarSign size={18} color={colors.accent} />
                    <Text fontSize={16} fontWeight="600" color={colors.text}>
                      Pricing
                    </Text>
                    <Text 
                      fontSize={12} 
                      color={getTierColor(activeModel.pricing.tier)}
                      backgroundColor={isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)"}
                      paddingHorizontal="$sm"
                      paddingVertical={2}
                      borderRadius="$sm"
                      textTransform="uppercase"
                      fontWeight="600"
                    >
                      {activeModel.pricing.tier}
                    </Text>
                  </XStack>
                  
                  <XStack gap="$md">
                    <YStack flex={1} backgroundColor={colors.bgTertiary} borderRadius="$md" padding="$md" borderWidth={1} borderColor={colors.border}>
                      <Text fontSize={12} color={colors.textSecondary}>Input</Text>
                      <Text fontSize={20} fontWeight="700" color={colors.text}>
                        {formatPricePerMillion(activeModel.pricing.input ?? undefined)}
                      </Text>
                      <Text fontSize={11} color={colors.textSecondary}>per 1M tokens</Text>
                    </YStack>
                    <YStack flex={1} backgroundColor={colors.bgTertiary} borderRadius="$md" padding="$md" borderWidth={1} borderColor={colors.border}>
                      <Text fontSize={12} color={colors.textSecondary}>Output</Text>
                      <Text fontSize={20} fontWeight="700" color={colors.text}>
                        {formatPricePerMillion(activeModel.pricing.output ?? undefined)}
                      </Text>
                      <Text fontSize={11} color={colors.textSecondary}>per 1M tokens</Text>
                    </YStack>
                  </XStack>
                </YStack>

                {/* Benchmarks */}
                <YStack gap="$md">
                  <XStack alignItems="center" gap="$sm">
                    <BarChart3 size={18} color={colors.blue} />
                    <Text fontSize={16} fontWeight="600" color={colors.text}>
                      Benchmarks
                    </Text>
                  </XStack>
                  
                  <YStack gap="$sm">
                    {activeModel.benchmarks.map((bench) => (
                      <XStack
                        key={bench.name}
                        justifyContent="space-between"
                        alignItems="center"
                        padding="$md"
                        backgroundColor={colors.bgTertiary}
                        borderRadius="$md"
                        borderWidth={1}
                        borderColor={colors.border}
                      >
                        <YStack>
                          <Text fontSize={14} fontWeight="600" color={colors.text}>
                            {bench.name}
                          </Text>
                          <Text fontSize={12} color={colors.textSecondary}>
                            {`Top ${100 - bench.percentile}th percentile`}
                          </Text>
                        </YStack>
                        <XStack alignItems="center" gap="$sm">
                          <Text fontSize={18} fontWeight="700" color={bench.score >= 80 ? colors.accent : colors.gold}>
                            {`${bench.score}%`}
                          </Text>
                        </XStack>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>

                {/* Performance Metrics */}
                <YStack gap="$md">
                  <XStack alignItems="center" gap="$sm">
                    <Gauge size={18} color={colors.red} />
                    <Text fontSize={16} fontWeight="600" color={colors.text}>
                      Performance
                    </Text>
                  </XStack>
                  
                  <YStack gap="$sm">
                    <XStack justifyContent="space-between" padding="$md" backgroundColor={colors.bgTertiary} borderRadius="$md">
                      <XStack alignItems="center" gap="$xs">
                        <Clock size={14} color={colors.textMuted} />
                        <Text fontSize={14} color={colors.textMuted}>Avg Latency</Text>
                      </XStack>
                      <Text fontSize={14} fontWeight="600" color={colors.text}>
                        {formatLatency(activeModel.latency.avg)}
                      </Text>
                    </XStack>
                    
                    <XStack justifyContent="space-between" padding="$md" backgroundColor={colors.bgTertiary} borderRadius="$md">
                      <XStack alignItems="center" gap="$xs">
                        <Zap size={14} color={colors.textMuted} />
                        <Text fontSize={14} color={colors.textMuted}>Throughput</Text>
                      </XStack>
                      <Text fontSize={14} fontWeight="600" color={colors.text}>
                        {`${activeModel.throughput.tokensPerSecond} tok/s`}
                      </Text>
                    </XStack>
                    
                    <XStack justifyContent="space-between" padding="$md" backgroundColor={colors.bgTertiary} borderRadius="$md">
                      <XStack alignItems="center" gap="$xs">
                        <TrendingUp size={14} color={colors.textMuted} />
                        <Text fontSize={14} color={colors.textMuted}>Context Window</Text>
                      </XStack>
                      <Text fontSize={14} fontWeight="600" color={colors.text}>
                        {`${formatNumber(activeModel.contextWindow)} tokens`}
                      </Text>
                    </XStack>
                  </YStack>
                </YStack>

                {/* Capabilities */}
                <YStack gap="$md">
                  <Text fontSize={16} fontWeight="600" color={colors.text}>
                    Capabilities
                  </Text>
                  <XStack flexWrap="wrap" gap="$xs">
                    {activeModel.capabilities.map((cap) => (
                      <Text
                        key={cap}
                        fontSize={12}
                        color={colors.accent}
                        backgroundColor={isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)"}
                        paddingHorizontal="$sm"
                        paddingVertical={6}
                        borderRadius="$md"
                        textTransform="capitalize"
                      >
                        {cap.replace(/-/g, " ")}
                      </Text>
                    ))}
                  </XStack>
                </YStack>

                {/* Strengths & Weaknesses */}
                <XStack gap="$md">
                  <YStack flex={1} gap="$sm">
                    <Text fontSize={14} fontWeight="600" color={colors.accent}>
                      Strengths
                    </Text>
                    {activeModel.strengths.slice(0, 3).map((s) => (
                      <XStack key={s} alignItems="center" gap="$xs">
                        <Check size={12} color={colors.accent} />
                        <Text fontSize={13} color={colors.textMuted}>{s}</Text>
                      </XStack>
                    ))}
                  </YStack>
                  
                  <YStack flex={1} gap="$sm">
                    <Text fontSize={14} fontWeight="600" color={colors.red}>
                      Weaknesses
                    </Text>
                    {activeModel.weaknesses.slice(0, 3).map((w) => (
                      <XStack key={w} alignItems="center" gap="$xs">
                        <X size={12} color={colors.red} />
                        <Text fontSize={13} color={colors.textSecondary}>{w}</Text>
                      </XStack>
                    ))}
                  </YStack>
                </XStack>

                {/* Actions */}
                <XStack gap="$md" marginTop="$md">
                  <Button
                    flex={1}
                    size="$4"
                    backgroundColor={selectedIds.has(activeModel.id) ? colors.red : colors.accent}
                    color="black"
                    borderRadius="$md"
                    fontWeight="600"
                    onPress={() => toggleSelection(activeModel.id)}
                    icon={selectedIds.has(activeModel.id) ? <X size={18} /> : <Check size={18} />}
                  >
                    {selectedIds.has(activeModel.id) ? "Remove from Compare" : "Add to Compare"}
                  </Button>
                  
                  <Button
                    flex={1}
                    size="$4"
                    backgroundColor={colors.blue}
                    color="white"
                    borderRadius="$md"
                    fontWeight="600"
                    onPress={() => router.push(`/studio?stack=${activeModel.id}`)}
                    icon={<Sparkles size={18} />}
                  >
                    Try in Studio
                  </Button>
                </XStack>
              </YStack>
            </div>
          </>
        )}
      </XStack>
    </YStack>
  );
}

export default function ModelsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading Model Hub...</div>}>
      <ModelHubContent />
    </Suspense>
  );
}
