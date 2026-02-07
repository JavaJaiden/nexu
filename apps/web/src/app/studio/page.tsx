"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { H1, Paragraph, Text, XStack, YStack, Button, Input } from "tamagui";
import { Plus, ChevronLeft, ChevronRight, Settings2, ChevronDown, X, Layers, Sparkles } from "lucide-react";
import { useThemeSetting } from "@/lib/themeContext";
import { getProviderIcon } from "@/lib/modelCatalog";
import Header from "@/components/Header";
import { Chat } from "@/components/chat";
import type { SaveTranscriptPayload } from "@/components/chat/types";
import AgentStackPicker from "@/components/AgentStackPicker";
import AgentPicker from "@/components/AgentPicker";
import {
  loadHistory,
  upsertHistoryEntry,
  type HistoryEntry,
  type TranscriptMessage,
} from "@/lib/historyStore";
import { loadLabPresets, type LabPreset } from "@/lib/labStore";
import { getModelHubCards, getModelNameMap, type ModelCard } from "@/lib/modelCatalog";
import type { ChatEntry } from "@/components/chat";
import type { Message } from "ai";

type HistoryViewFilter = "single" | "multi" | "presets";
const HISTORY_PAGE_SIZE = 3;

function isMultiModelProject(project: HistoryEntry) {
  return project.models.length > 1 || project.subject === "Model Hub Compare";
}

function StudioPageContent() {
  // Theme
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
    }),
    []
  );
  
  // Core state
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [mode, setMode] = useState<"fast" | "deep" | "none">("none");
  const [showSteps, setShowSteps] = useState(true);
  const [showCitations, setShowCitations] = useState(true);
  const collapseAll = true;
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
  
  // Sidebar list state
  const [showHistoryCount, setShowHistoryCount] = useState(HISTORY_PAGE_SIZE);
  const [historyViewFilter, setHistoryViewFilter] = useState<HistoryViewFilter>("multi");

  // Model selection
  const [preferredModels, setPreferredModels] = useState<string[]>([]);
  const [aggregatorModel, setAggregatorModel] = useState("auto");

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectSearch, setProjectSearch] = useState("");
  const [projects, setProjects] = useState<HistoryEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Data
  const modelCatalog = useMemo(() => getModelHubCards(), []);
  const modelNameMap = useMemo(() => getModelNameMap(), []);
  const modelMetaMap = useMemo(() => new Map(modelCatalog.map((m) => [m.id, m])), [modelCatalog]);
  const [labPresets, setLabPresets] = useState<LabPreset[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Load initial data
  useEffect(() => {
    setProjects(loadHistory());
    setLabPresets(loadLabPresets());

    const handler = () => setLabPresets(loadLabPresets());
    window.addEventListener("lab-presets-updated", handler);
    return () => window.removeEventListener("lab-presets-updated", handler);
  }, []);

  // Handle project ID from URL
  useEffect(() => {
    const projectId = searchParams.get("project");
    if (projectId) {
      setSelectedProjectId(projectId);
      setChatId(projectId);
    }
  }, [searchParams]);

  // Handle stack param from URL
  useEffect(() => {
    const stackParam = searchParams.get("stack");
    if (stackParam) {
      const stack = Array.from(
        new Set(stackParam.split(",").map((s) => s.trim()).filter(Boolean))
      );
      if (stack.length > 0) {
        setPreferredModels(stack);
        setSelectedProjectId(null);
        router.replace("/studio");
      }
    }
  }, [searchParams, router]);

  // Get active project
  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  // Build initial timeline from project
  const initialTimeline = useMemo((): ChatEntry[] | undefined => {
    if (!activeProject) return undefined;
    let index = 0;
    return activeProject.transcript
      .map((item): ChatEntry | null => {
        if ("type" in item && item.type === "model_selection_snapshot") {
          return { kind: "snapshot", snapshot: item };
        }
        if ("role" in item) {
          return {
            kind: "message",
            message: {
              id: `${activeProject.id}-${index++}`,
              role: item.role,
              content: item.content ?? "",
              snapshotId: item.snapshotId,
            } as Message & { snapshotId?: string },
          };
        }
        return null;
      })
      .filter((e): e is ChatEntry => Boolean(e));
  }, [activeProject]);

  // Build tool overrides from project
  const toolOverrides = useMemo(() => {
    if (!activeProject) return undefined;
    let index = 0;
    return activeProject.transcript.reduce<Record<string, TranscriptMessage["tools"]>>(
      (acc, item) => {
        if ("role" in item) {
          const id = `${activeProject.id}-${index++}`;
          if (item.role === "assistant" && item.tools) {
            acc[id] = item.tools;
          }
        }
        return acc;
      },
      {}
    );
  }, [activeProject]);

  const toolOverridesByIndex = useMemo(() => {
    if (!activeProject) return undefined;
    return activeProject.transcript
      .filter((item): item is TranscriptMessage => "role" in item)
      .map((msg) => (msg.role === "assistant" ? msg.tools : undefined));
  }, [activeProject]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const query = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.question.toLowerCase().includes(query) ||
        p.subject.toLowerCase().includes(query) ||
        p.models.join(" ").toLowerCase().includes(query)
    );
  }, [projects, projectSearch]);

  const filteredPresets = useMemo(() => {
    if (!projectSearch.trim()) return labPresets;
    const query = projectSearch.toLowerCase();
    return labPresets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(query) ||
        (preset.subject ?? "").toLowerCase().includes(query) ||
        preset.models.join(" ").toLowerCase().includes(query)
    );
  }, [labPresets, projectSearch]);

  const visibleHistoryItems = useMemo(() => {
    if (historyViewFilter === "single") {
      return filteredProjects
        .filter((project) => !isMultiModelProject(project))
        .map((project) => ({ kind: "project" as const, project }));
    }
    if (historyViewFilter === "multi") {
      return filteredProjects
        .filter((project) => isMultiModelProject(project))
        .map((project) => ({ kind: "project" as const, project }));
    }
    return filteredPresets.map((preset) => ({ kind: "preset" as const, preset }));
  }, [historyViewFilter, filteredProjects, filteredPresets]);

  useEffect(() => {
    setShowHistoryCount(HISTORY_PAGE_SIZE);
  }, [historyViewFilter, projectSearch]);

  // Get selected model details
  const selectedModelDetails = useMemo(() => {
    return Array.from(new Set(preferredModels))
      .map((id) => modelMetaMap.get(id))
      .filter(Boolean) as ModelCard[];
  }, [preferredModels, modelMetaMap]);

  // Get aggregator model details
  const aggregatorModelDetails = useMemo(() => {
    if (aggregatorModel === "auto") return null;
    return modelMetaMap.get(aggregatorModel);
  }, [aggregatorModel, modelMetaMap]);

  // Remove model from selection
  const removeModel = useCallback((modelId: string) => {
    setPreferredModels((prev) => prev.filter((id) => id !== modelId));
  }, []);

  // Handlers
  const handleNewChat = useCallback(() => {
    setChatId(crypto.randomUUID());
    setSelectedProjectId(null);
    setAttachments([]);
    router.push("/studio");
  }, [router]);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      setChatId(projectId);
      router.push(`/studio?project=${projectId}`);
    },
    [router]
  );

  const handleSaveTranscript = useCallback(
    ({ transcript, models, mode, hasRun }: SaveTranscriptPayload) => {
      const firstUserMsg = transcript.find(
        (t): t is TranscriptMessage =>
          "role" in t && t.role === "user" && (t.content ?? "").trim().length > 0
      );
      if (!firstUserMsg) return;

      const question = (firstUserMsg.content ?? "").trim() || "New chat";
      const entries = loadHistory();
      const existing = entries.find((entry) => entry.id === chatId);
      const existingTranscriptSignature = existing ? JSON.stringify(existing.transcript) : null;
      const nextTranscriptSignature = JSON.stringify(transcript);
      const createdAt = existing?.createdAt ?? new Date().toISOString();
      const subject = existing?.subject ?? "General";
      const shouldOverrideModels = hasRun || !existing;
      const normalizedModels =
        models.length && shouldOverrideModels ? models : existing?.models ?? models;
      const dedupedModels = Array.from(new Set(normalizedModels.filter(Boolean)));
      const model = dedupedModels[0] ?? existing?.model ?? "Nexus-Core";
      const finalModels = dedupedModels.length ? dedupedModels : [model];
      const hasSameModels = existing
        ? existing.models.length === finalModels.length &&
          existing.models.every((modelId, index) => modelId === finalModels[index])
        : false;

      if (
        existing &&
        existingTranscriptSignature === nextTranscriptSignature &&
        existing.mode === mode &&
        existing.model === model &&
        hasSameModels
      ) {
        return;
      }

      const nextEntry: HistoryEntry = {
        id: chatId,
        question,
        subject,
        model,
        models: finalModels,
        transcript,
        mode,
        createdAt,
      };

      const hasNewInformation =
        !existing || existingTranscriptSignature !== nextTranscriptSignature;
      const nextEntries = upsertHistoryEntry(nextEntry, { moveToTop: hasNewInformation });
      setProjects(nextEntries);
    },
    [chatId]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getProjectTitle = (project: HistoryEntry) => {
    const firstUserMsg = project.transcript.find(
      (t): t is TranscriptMessage => "role" in t && t.role === "user"
    );
    return firstUserMsg?.content ?? project.question;
  };

  return (
    <YStack flex={1} backgroundColor={colors.bg} minHeight="100vh">
      <Header />

      <YStack flex={1} padding="$lg" maxWidth={1600} width="100%" marginHorizontal="auto">
        {/* Header */}
        <YStack marginBottom="$lg" gap="$xs">
          <H1 fontSize={28} fontWeight="700" color={colors.text}>
            Studio
          </H1>
          <Paragraph color={colors.textMuted} fontSize={15} maxWidth={600}>
            Ask questions and compare responses from multiple AI models. Nexus aggregates the best answers.
          </Paragraph>
        </YStack>

        <XStack flex={1} gap="$lg" flexWrap="nowrap">
          {/* Sidebar */}
          {sidebarOpen && (
            <YStack
              width={300}
              minWidth={260}
              maxWidth={320}
              alignSelf="flex-start"
              gap="$md"
              padding="$md"
              backgroundColor={colors.bgSecondary}
              borderRadius="$lg"
              borderWidth={1}
              borderColor={colors.border}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Previous 30 days
                </Text>
                <XStack gap="$xs">
                  <Button
                    size="$2"
                    backgroundColor={colors.accent}
                    color="black"
                    onPress={handleNewChat}
                    icon={<Plus size={14} />}
                  >
                    New
                  </Button>
                  <Button
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor={colors.border}
                    color={colors.text}
                    onPress={() => setSidebarOpen(false)}
                    icon={<ChevronLeft size={14} />}
                  />
                </XStack>
              </XStack>

              <YStack gap="$xs">
                <Text fontSize={11} fontWeight="600" color={colors.textMuted}>
                  View
                </Text>
                <YStack
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius="$sm"
                  backgroundColor={colors.bg}
                  paddingHorizontal="$sm"
                >
                  <select
                    value={historyViewFilter}
                    onChange={(event) =>
                      setHistoryViewFilter(event.currentTarget.value as HistoryViewFilter)
                    }
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: colors.text,
                      fontSize: 13,
                      padding: "8px 0",
                    }}
                  >
                    <option value="single">Single Model</option>
                    <option value="multi">Multi-Model</option>
                    <option value="presets">Project Presets</option>
                  </select>
                </YStack>
              </YStack>

              <Input
                value={projectSearch}
                onChangeText={setProjectSearch}
                placeholder="Search chats & presets..."
                borderColor={colors.border}
                backgroundColor={colors.bg}
                color={colors.text}
                placeholderTextColor={colors.textMuted}
                fontSize={14}
              />

              <YStack gap="$sm">
                <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                  {historyViewFilter === "presets" ? "Project presets" : "Chats"}
                </Text>

                {visibleHistoryItems.length === 0 ? (
                  <Text fontSize={13} color={colors.textMuted}>
                    {historyViewFilter === "presets"
                      ? "No saved project presets"
                      : historyViewFilter === "single"
                        ? "No single-model chats"
                        : "No multi-model chats"}
                  </Text>
                ) : (
                  <>
                    <YStack
                      borderRadius="$md"
                      padding="$xs"
                      style={{ maxHeight: 360, overflowY: "auto", overflowX: "hidden" }}
                    >
                      <YStack gap="$xs">
                        {visibleHistoryItems.slice(0, showHistoryCount).map((item) => {
                          if (item.kind === "preset") {
                            const uniquePresetModels = Array.from(new Set(item.preset.models));
                            const isPresetActive =
                              uniquePresetModels.length > 0 &&
                              uniquePresetModels.length === preferredModels.length &&
                              uniquePresetModels.every((modelId) => preferredModels.includes(modelId));

                            return (
                              <Button
                                key={item.preset.id}
                                size="$3"
                                backgroundColor={isPresetActive ? colors.bg : "transparent"}
                                borderWidth={1}
                                borderColor={isPresetActive ? colors.accent : colors.border}
                                justifyContent="flex-start"
                                onPress={() => {
                                  setPreferredModels(uniquePresetModels);
                                  setSelectedProjectId(null);
                                  router.push("/studio");
                                }}
                              >
                                <YStack alignItems="flex-start" gap="$xs" width="100%">
                                  <XStack alignItems="center" gap="$xs">
                                    <Layers size={12} color={colors.accent} />
                                    <Text fontSize={13} fontWeight="500" color={colors.text} numberOfLines={1}>
                                      {item.preset.name}
                                    </Text>
                                  </XStack>
                                  <XStack justifyContent="space-between" width="100%" alignItems="center">
                                    <XStack gap="$sm">
                                      <Text fontSize={11} color={colors.textMuted}>
                                        {item.preset.subject ?? "Project preset"}
                                      </Text>
                                      <Text fontSize={11} color={colors.textSecondary}>
                                        {formatDate(item.preset.createdAt)}
                                      </Text>
                                    </XStack>
                                    <XStack alignItems="center" gap="$xs">
                                      {uniquePresetModels.slice(0, 3).map((modelId) => (
                                        <Text key={modelId} fontSize={10} color={colors.textSecondary}>
                                          {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                                        </Text>
                                      ))}
                                      {uniquePresetModels.length > 3 && (
                                        <Text fontSize={10} color={colors.textMuted}>
                                          +{uniquePresetModels.length - 3}
                                        </Text>
                                      )}
                                    </XStack>
                                  </XStack>
                                </YStack>
                              </Button>
                            );
                          }

                          const project = item.project;
                          const isActive = project.id === selectedProjectId;
                          const title = getProjectTitle(project);
                          const uniqueModels = Array.from(new Set(project.models));

                          return (
                            <Button
                              key={project.id}
                              size="$3"
                              backgroundColor={isActive ? colors.bg : "transparent"}
                              borderWidth={1}
                              borderColor={isActive ? colors.accent : colors.border}
                              justifyContent="flex-start"
                              onPress={() => handleSelectProject(project.id)}
                            >
                              <YStack alignItems="flex-start" gap="$xs" width="100%">
                                <Text
                                  fontSize={13}
                                  fontWeight="500"
                                  color={colors.text}
                                  numberOfLines={1}
                                >
                                  {title.length > 40 ? `${title.slice(0, 40)}...` : title}
                                </Text>
                                <XStack justifyContent="space-between" width="100%" alignItems="center">
                                  <XStack gap="$sm">
                                    <Text fontSize={11} color={colors.textMuted}>
                                      {isMultiModelProject(project) ? "Multi-Model" : "Single Model"}
                                    </Text>
                                    <Text fontSize={11} color={colors.textSecondary}>
                                      {formatDate(project.createdAt)}
                                    </Text>
                                  </XStack>
                                  <XStack alignItems="center" gap="$xs">
                                    {uniqueModels.slice(0, 3).map((modelId) => (
                                      <Text key={modelId} fontSize={10} color={colors.textSecondary}>
                                        {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                                      </Text>
                                    ))}
                                    {uniqueModels.length > 3 && (
                                      <Text fontSize={10} color={colors.textMuted}>
                                        +{uniqueModels.length - 3}
                                      </Text>
                                    )}
                                  </XStack>
                                </XStack>
                              </YStack>
                            </Button>
                          );
                        })}
                      </YStack>
                    </YStack>

                    {visibleHistoryItems.length > showHistoryCount && (
                      <Button
                        size="$2"
                        backgroundColor="transparent"
                        borderWidth={0}
                        color={colors.accent}
                        onPress={() => setShowHistoryCount((count) => count + HISTORY_PAGE_SIZE)}
                        icon={<ChevronDown size={14} />}
                      >
                        {`Show ${Math.min(HISTORY_PAGE_SIZE, visibleHistoryItems.length - showHistoryCount)} more`}
                      </Button>
                    )}
                  </>
                )}
              </YStack>
            </YStack>
          )}

          {/* Main Content */}
          <YStack flex={1} gap="$md" minWidth={400}>
            {/* Show sidebar toggle when closed */}
            {!sidebarOpen && (
              <XStack>
                <Button
                  size="$3"
                  backgroundColor={colors.bgSecondary}
                  borderWidth={1}
                  borderColor={colors.border}
                  color={colors.text}
                  onPress={() => setSidebarOpen(true)}
                  icon={<ChevronRight size={16} />}
                >
                  Show History
                </Button>
              </XStack>
            )}

            {/* Model Selection Panel */}
            <YStack
              gap="$md"
              padding="$md"
              backgroundColor={colors.bgSecondary}
              borderRadius="$lg"
              borderWidth={1}
              borderColor={colors.border}
            >
              <XStack alignItems="center" gap="$xs">
                <Settings2 size={16} color={colors.textMuted} />
                <Text fontSize={14} fontWeight="600" color={colors.text}>
                  Model Configuration
                </Text>
              </XStack>

              <XStack gap="$lg" flexWrap="wrap">
                <YStack gap="$xs" flex={1} minWidth={240}>
                  <Text fontSize={13} fontWeight="500" color={colors.text}>
                    Model Stack
                  </Text>
                  <AgentStackPicker
                    selectedIds={preferredModels}
                    onChange={setPreferredModels}
                    models={modelCatalog}
                    presets={labPresets}
                    defaultCount={3}
                  />
                  
                  {/* Selected Model Cards */}
                  {selectedModelDetails.length > 0 && (
                    <XStack flexWrap="wrap" gap="$xs" marginTop="$xs">
                      {selectedModelDetails.map((model) => (
                        <XStack
                          key={model.id}
                          alignItems="center"
                          gap="$xs"
                          paddingHorizontal="$sm"
                          paddingVertical="$xs"
                          backgroundColor={colors.bgTertiary}
                          borderWidth={1}
                          borderColor={colors.border}
                          borderRadius="$md"
                        >
                          <Text fontSize={12} color={colors.textMuted}>
                            {getProviderIcon(model.provider)}
                          </Text>
                          <Text fontSize={12} color={colors.text}>
                            {model.name}
                          </Text>
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={0}
                            padding={0}
                            onPress={() => removeModel(model.id)}
                            icon={<X size={12} color={colors.textMuted} />}
                          />
                        </XStack>
                      ))}
                    </XStack>
                  )}
                  
                  <Text fontSize={12} color={colors.textMuted}>
                    {preferredModels.length >= 2
                      ? `${preferredModels.length} models selected`
                      : "Using default Nexus routers"}
                  </Text>
                </YStack>

                <YStack gap="$xs" minWidth={200}>
                  <Text fontSize={13} fontWeight="500" color={colors.text}>
                    Aggregator
                  </Text>
                  <AgentPicker
                    value={aggregatorModel}
                    onChange={setAggregatorModel}
                    models={modelCatalog}
                  />
                  
                  {/* Aggregator Model Card */}
                  {aggregatorModelDetails && (
                    <XStack
                      alignItems="center"
                      gap="$xs"
                      paddingHorizontal="$sm"
                      paddingVertical="$xs"
                      backgroundColor={isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)"}
                      borderWidth={1}
                      borderColor={colors.accent}
                      borderRadius="$md"
                      marginTop="$xs"
                      alignSelf="flex-start"
                    >
                      <Sparkles size={12} color={colors.accent} />
                      <Text fontSize={12} color={colors.accent}>
                        {aggregatorModelDetails.name}
                      </Text>
                      <Button
                        size="$1"
                        backgroundColor="transparent"
                        borderWidth={0}
                        padding={0}
                        onPress={() => setAggregatorModel("auto")}
                        icon={<X size={12} color={colors.accent} />}
                      />
                    </XStack>
                  )}
                  
                  <Text fontSize={12} color={colors.textMuted}>
                    {aggregatorModel === "auto" ? "Auto-selects best model" : "Custom aggregator"}
                  </Text>
                </YStack>

              </XStack>
            </YStack>

            {/* Chat - dynamically sized */}
            <YStack
              flex={1}
              padding="$md"
              backgroundColor={colors.bgSecondary}
              borderRadius="$lg"
              borderWidth={1}
              borderColor={colors.border}
            >
              <Chat
                key={chatId}
                chatId={chatId}
                mode={mode}
                preferredModels={preferredModels}
                aggregatorModel={aggregatorModel}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                showSteps={showSteps}
                showCitations={showCitations}
                onModeChange={setMode}
                onToggleSteps={() => setShowSteps((prev) => !prev)}
                onToggleCitations={() => setShowCitations((prev) => !prev)}
                onSetAggregatorModel={setAggregatorModel}
                onAddModelsToStack={(modelIds) =>
                  setPreferredModels((prev) => Array.from(new Set([...prev, ...modelIds])))
                }
                collapseAll={collapseAll}
                modelMetaMap={modelMetaMap}
                modelNameMap={modelNameMap}
                initialTimeline={initialTimeline}
                toolOverrides={toolOverrides}
                toolOverridesByIndex={toolOverridesByIndex}
                onSaveTranscript={handleSaveTranscript}
                onRequestNewChat={handleNewChat}
              />
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
      <StudioPageContent />
    </Suspense>
  );
}
