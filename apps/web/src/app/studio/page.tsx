"use client";

import { useState, useEffect, useMemo, useCallback, useId, Suspense } from "react";
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

function StudioPageContent() {
  // Theme
  const { theme } = useThemeSetting();
  const isDark = theme === "dark";
  
  // Theme colors
  const colors = useMemo(() => ({
    bg: isDark ? "#0a0a0b" : "#ffffff",
    bgSecondary: isDark ? "#141415" : "#f8f9fa",
    bgTertiary: isDark ? "#1a1a1b" : "#f1f3f5",
    border: isDark ? "#2a2a2b" : "#e9ecef",
    text: isDark ? "#ffffff" : "#111827",
    textMuted: isDark ? "#9CA3AF" : "#6b7280",
    textSecondary: isDark ? "#6b7280" : "#9ca3af",
    accent: "#22C55E",
  }), [isDark]);
  
  // Core state
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [mode, setMode] = useState<"fast" | "deep">("fast");
  const [showSteps, setShowSteps] = useState(true);
  const [showCitations, setShowCitations] = useState(true);
  const collapseAll = true;
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
  
  // Pagination state
  const [showGroupedCount, setShowGroupedCount] = useState(5);
  const [showUngroupedCount, setShowUngroupedCount] = useState(5);

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
      const stack = stackParam.split(",").map((s) => s.trim()).filter(Boolean);
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

  // Build initial messages from project
  const initialMessages = useMemo(() => {
    if (!activeProject) return undefined;
    let index = 0;
    return activeProject.transcript
      .filter((item): item is TranscriptMessage => "role" in item)
      .map((msg) => ({
        id: `${activeProject.id}-${index++}`,
        role: msg.role,
        content: msg.content ?? "",
        snapshotId: msg.snapshotId,
      }));
  }, [activeProject]);

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

  const groupedProjects = useMemo(
    () => filteredProjects.filter((p) => p.models.length > 1 || p.subject === "Model Hub Compare"),
    [filteredProjects]
  );

  const ungroupedProjects = useMemo(
    () => filteredProjects.filter((p) => !(p.models.length > 1 || p.subject === "Model Hub Compare")),
    [filteredProjects]
  );

  // Get selected model details
  const selectedModelDetails = useMemo(() => {
    return preferredModels.map((id) => modelMetaMap.get(id)).filter(Boolean) as ModelCard[];
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
        (t): t is TranscriptMessage => "role" in t && t.role === "user" && (t.content ?? "").trim()
      );
      if (!firstUserMsg) return;

      const question = (firstUserMsg.content ?? "").trim() || "New chat";
      const entries = loadHistory();
      const existing = entries.find((entry) => entry.id === chatId);
      const createdAt = existing?.createdAt ?? new Date().toISOString();
      const subject = existing?.subject ?? "General";
      const shouldOverrideModels = hasRun || !existing;
      const normalizedModels =
        models.length && shouldOverrideModels ? models : existing?.models ?? models;
      const model = normalizedModels[0] ?? existing?.model ?? "Nexus-Core";
      const finalModels = normalizedModels.length ? normalizedModels : [model];

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

      const nextEntries = upsertHistoryEntry(nextEntry);
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
              gap="$md"
              padding="$md"
              backgroundColor={colors.bgSecondary}
              borderRadius="$lg"
              borderWidth={1}
              borderColor={colors.border}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  History
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

              <Input
                value={projectSearch}
                onChangeText={setProjectSearch}
                placeholder="Search projects..."
                borderColor={colors.border}
                backgroundColor={colors.bg}
                color={colors.text}
                placeholderTextColor={colors.textMuted}
                fontSize={14}
              />

              <YStack flex={1} gap="$md" overflow="scroll">
                {/* Grouped Projects */}
                <YStack gap="$xs">
                  <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                    Multi-Model
                  </Text>
                  {groupedProjects.length === 0 ? (
                    <Text fontSize={13} color={colors.textMuted}>
                      No multi-model chats
                    </Text>
                  ) : (
                    <YStack gap="$xs">
                      {groupedProjects.slice(0, showGroupedCount).map((project) => {
                        const isActive = project.id === selectedProjectId;
                        const title = getProjectTitle(project);
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
                                    {project.subject}
                                  </Text>
                                  <Text fontSize={11} color={colors.textSecondary}>
                                    {formatDate(project.createdAt)}
                                  </Text>
                                </XStack>
                                <XStack alignItems="center" gap="$xs">
                                  {project.models.slice(0, 3).map((modelId) => (
                                    <Text key={modelId} fontSize={10} color={colors.textSecondary}>
                                      {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                                    </Text>
                                  ))}
                                  {project.models.length > 3 && (
                                    <Text fontSize={10} color={colors.textMuted}>
                                      +{project.models.length - 3}
                                    </Text>
                                  )}
                                </XStack>
                              </XStack>
                            </YStack>
                          </Button>
                        );
                      })}
                      {groupedProjects.length > showGroupedCount && (
                        <Button
                          size="$2"
                          backgroundColor="transparent"
                          borderWidth={0}
                          color={colors.accent}
                          onPress={() => setShowGroupedCount((c) => c + 5)}
                          icon={<ChevronDown size={14} />}
                        >
                          {`Show ${Math.min(5, groupedProjects.length - showGroupedCount)} more`}
                        </Button>
                      )}
                    </YStack>
                  )}
                </YStack>

                {/* Saved Presets */}
                {labPresets.length > 0 && (
                  <YStack gap="$xs">
                    <Text fontSize={12} fontWeight="600" color={colors.accent}>
                      Saved Presets
                    </Text>
                    <YStack gap="$xs">
                      {labPresets.slice(0, 5).map((preset) => (
                        <Button
                          key={preset.id}
                          size="$3"
                          backgroundColor="transparent"
                          borderWidth={1}
                          borderColor={colors.border}
                          justifyContent="flex-start"
                          onPress={() => setPreferredModels(preset.models)}
                        >
                          <YStack alignItems="flex-start" gap="$xs">
                            <XStack alignItems="center" gap="$xs">
                              <Layers size={12} color={colors.accent} />
                              <Text fontSize={13} fontWeight="500" color={colors.text}>
                                {preset.name}
                              </Text>
                            </XStack>
                            <XStack alignItems="center" gap="$xs">
                              {preset.models.slice(0, 3).map((modelId) => (
                                <Text key={modelId} fontSize={10} color={colors.textSecondary}>
                                  {getProviderIcon(modelMetaMap.get(modelId)?.provider ?? "")}
                                </Text>
                              ))}
                              {preset.models.length > 3 && (
                                <Text fontSize={10} color={colors.textMuted}>
                                  +{preset.models.length - 3}
                                </Text>
                              )}
                            </XStack>
                          </YStack>
                        </Button>
                      ))}
                    </YStack>
                  </YStack>
                )}

                {/* Ungrouped Projects */}
                <YStack gap="$xs">
                  <Text fontSize={12} fontWeight="600" color={colors.textMuted}>
                    Single Model
                  </Text>
                  {ungroupedProjects.length === 0 ? (
                    <Text fontSize={13} color={colors.textMuted}>
                      No single-model chats
                    </Text>
                  ) : (
                    <YStack gap="$xs">
                      {ungroupedProjects.slice(0, showUngroupedCount).map((project) => {
                        const isActive = project.id === selectedProjectId;
                        const title = getProjectTitle(project);
                        const modelId = project.models[0];
                        const model = modelId ? modelMetaMap.get(modelId) : null;
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
                                    {project.subject}
                                  </Text>
                                  <Text fontSize={11} color={colors.textSecondary}>
                                    {formatDate(project.createdAt)}
                                  </Text>
                                </XStack>
                                {model && (
                                  <Text fontSize={10} color={colors.textSecondary}>
                                    {getProviderIcon(model.provider)}
                                  </Text>
                                )}
                              </XStack>
                            </YStack>
                          </Button>
                        );
                      })}
                      {ungroupedProjects.length > showUngroupedCount && (
                        <Button
                          size="$2"
                          backgroundColor="transparent"
                          borderWidth={0}
                          color={colors.accent}
                          onPress={() => setShowUngroupedCount((c) => c + 5)}
                          icon={<ChevronDown size={14} />}
                        >
                          {`Show ${Math.min(5, ungroupedProjects.length - showUngroupedCount)} more`}
                        </Button>
                      )}
                    </YStack>
                  )}
                </YStack>
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

                <YStack gap="$xs" minWidth={120}>
                  <Text fontSize={13} fontWeight="500" color={colors.text}>
                    Mode
                  </Text>
                  <XStack gap="$xs">
                    <Button
                      size="$3"
                      flex={1}
                      backgroundColor={mode === "fast" ? colors.accent : "transparent"}
                      color={mode === "fast" ? "black" : colors.text}
                      borderWidth={1}
                      borderColor={colors.border}
                      onPress={() => setMode("fast")}
                    >
                      Fast
                    </Button>
                    <Button
                      size="$3"
                      flex={1}
                      backgroundColor={mode === "deep" ? colors.accent : "transparent"}
                      color={mode === "deep" ? "black" : colors.text}
                      borderWidth={1}
                      borderColor={colors.border}
                      onPress={() => setMode("deep")}
                    >
                      Deep
                    </Button>
                  </XStack>
                </YStack>
              </XStack>

              {/* Toggles */}
              <XStack gap="$sm" flexWrap="wrap">
                <Button
                  size="$2"
                  backgroundColor={showSteps ? colors.accent : "transparent"}
                  color={showSteps ? "black" : colors.text}
                  borderWidth={1}
                  borderColor={colors.border}
                  onPress={() => setShowSteps(!showSteps)}
                >
                  {showSteps ? "✓" : "○"} Steps
                </Button>
                <Button
                  size="$2"
                  backgroundColor={showCitations ? colors.accent : "transparent"}
                  color={showCitations ? "black" : colors.text}
                  borderWidth={1}
                  borderColor={colors.border}
                  onPress={() => setShowCitations(!showCitations)}
                >
                  {showCitations ? "✓" : "○"} Citations
                </Button>
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
                collapseAll={collapseAll}
                modelMetaMap={modelMetaMap}
                modelNameMap={modelNameMap}
                initialMessages={initialMessages}
                initialTimeline={initialTimeline}
                toolOverrides={toolOverrides}
                toolOverridesByIndex={toolOverridesByIndex}
                onSaveTranscript={handleSaveTranscript}
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
