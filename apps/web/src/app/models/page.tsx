"use client";

import Header from "@/components/Header";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, H1, Paragraph, Text, TextArea, XStack, YStack } from "tamagui";
import { X } from "lucide-react";
import { loadHistory, upsertHistoryEntry, type HistoryEntry } from "@/lib/historyStore";
import { getModelHubCards } from "@/lib/modelCatalog";
import { useRouter } from "next/navigation";

export default function ModelsPage() {
  const allModels = useMemo(() => {
    return getModelHubCards();
  }, []);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [discoveryInput, setDiscoveryInput] = useState("");
  const [discoveryMessages, setDiscoveryMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      recommendations?: Array<{ id: string; reason: string }>;
    }>
  >([]);
  const [discoveryFilterIds, setDiscoveryFilterIds] = useState<Set<string> | null>(null);
  const [compareBanner, setCompareBanner] = useState<string | null>(null);
  const [compareQuestion, setCompareQuestion] = useState("");
  const [compareStatus, setCompareStatus] = useState<"idle" | "loading" | "error">("idle");
  const [responseSettings, setResponseSettings] = useState({
    streaming: true,
    temperature: 0.6,
    maxTokens: 800,
  });
  const [maxSameModel] = useState(5);
  const [compareResults, setCompareResults] = useState<
    Array<{
      model: string;
      usedModel: string;
      final: string;
      steps: string[];
      confidence: number;
      durationMs: number;
      gatewayNote?: string;
      selectionReason?: string;
    }>
  >([]);
  const [compareSessionId, setCompareSessionId] = useState<string | null>(null);
  const compareSectionRef = useRef<HTMLDivElement | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [infoPanel, setInfoPanel] = useState<"rankings" | "instructor" | "difference" | null>(
    null
  );
  const [isNarrow, setIsNarrow] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsNarrow(window.innerWidth < 980);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!activeModelId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveModelId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModelId]);

  useEffect(() => {
    if (activeModelId) {
      detailPanelRef.current?.focus();
    }
  }, [activeModelId]);

  useEffect(() => {
    setHistoryEntries(loadHistory());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("model_hub_discovery_chat_v1");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as typeof discoveryMessages;
      if (Array.isArray(parsed)) setDiscoveryMessages(parsed);
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "model_hub_discovery_chat_v1",
      JSON.stringify(discoveryMessages)
    );
  }, [discoveryMessages]);

  const modelDisplayName = useMemo(() => {
    const map = new Map<string, string>();
    allModels.forEach((model) => map.set(model.id, model.name));
    return map;
  }, [allModels]);

  const personalizedRankings = useMemo(() => {
    const stats = new Map<
      string,
      { totalConfidence: number; confidenceCount: number; count: number; lastUsed: number }
    >();

    for (const entry of historyEntries) {
      const createdAt = new Date(entry.createdAt).getTime();
      for (const message of entry.transcript ?? []) {
        if (!message || typeof message !== "object" || !("role" in message)) continue;
        const solves = message.tools?.solveQuestions ?? [];
        for (const solve of solves) {
          if (!solve.model) continue;
          const bucket =
            stats.get(solve.model) ?? {
              totalConfidence: 0,
              confidenceCount: 0,
              count: 0,
              lastUsed: 0,
            };
          bucket.count += 1;
          if (typeof solve.confidence === "number") {
            bucket.totalConfidence += solve.confidence;
            bucket.confidenceCount += 1;
          }
          if (!Number.isNaN(createdAt)) {
            bucket.lastUsed = Math.max(bucket.lastUsed, createdAt);
          }
          stats.set(solve.model, bucket);
        }
      }
    }

    const results = Array.from(stats.entries()).map(([modelId, bucket]) => {
      const avgConfidence =
        bucket.confidenceCount > 0 ? bucket.totalConfidence / bucket.confidenceCount : null;
      const score = (avgConfidence ?? 0.65) * 0.7 + Math.min(1, bucket.count / 8) * 0.3;
      return {
        id: modelId,
        name: modelDisplayName.get(modelId) ?? modelId,
        usageCount: bucket.count,
        avgConfidence,
        score,
        lastUsed: bucket.lastUsed,
      };
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [historyEntries, modelDisplayName]);

  const differenceSummary = useMemo(() => {
    if (compareResults.length < 2) return null;
    const sortedByConfidence = [...compareResults].sort((a, b) => b.confidence - a.confidence);
    const sortedByLatency = [...compareResults].sort((a, b) => a.durationMs - b.durationMs);
    const wordCounts = compareResults.map((result) => result.final.split(/\s+/).filter(Boolean).length);
    const stepCounts = compareResults.map((result) => result.steps.length);
    const minWords = Math.min(...wordCounts);
    const maxWords = Math.max(...wordCounts);
    const minSteps = Math.min(...stepCounts);
    const maxSteps = Math.max(...stepCounts);
    return {
      bestConfidence: sortedByConfidence[0],
      fastest: sortedByLatency[0],
      wordRange: [minWords, maxWords] as const,
      stepRange: [minSteps, maxSteps] as const,
    };
  }, [compareResults]);

  const instructorRecommendations = useMemo(
    () => [
      {
        subject: "Math & Physics",
        models: ["Nexus-Math", "o1", "gpt-4.1"],
        note: "Prioritize rigor and step-by-step clarity.",
      },
      {
        subject: "Writing & History",
        models: ["Nexus-Write", "gpt-4o", "claude-3.5-sonnet"],
        note: "Focus on tone, structure, and citations.",
      },
      {
        subject: "Code & Debugging",
        models: ["Nexus-Code", "gpt-4.1-mini", "o3-mini"],
        note: "Fast iteration with strong reasoning.",
      },
    ],
    []
  );

  const selectedModels = useMemo(
    () => allModels.filter((model) => selectedIds.has(model.id)),
    [allModels, selectedIds]
  );

  const activeModel = useMemo(
    () => allModels.find((model) => model.id === activeModelId) ?? null,
    [allModels, activeModelId]
  );

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    const base = allModels.filter((model) =>
      discoveryFilterIds ? discoveryFilterIds.has(model.id) : true
    );
    if (!query) return base;
    return base.filter((model) => {
      const haystack = [
        model.name,
        model.provider,
        model.type,
        model.routing,
        model.useCases.join(" "),
        model.strengths.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allModels, discoveryFilterIds, modelSearch]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setCompareBanner((prev) => {
      if (prev) return prev;
      return selectedIds.has(id) ? "Removed from compare" : "Added to compare";
    });
    setTimeout(() => setCompareBanner(null), 1600);
  };

  const handleDeployToStudio = (modelId: string) => {
    const params = new URLSearchParams();
    params.set("stack", modelId);
    router.push(`/studio?${params.toString()}`);
  };

  const scoreFromLabel = (label?: string) => {
    switch (label?.toLowerCase()) {
      case "high":
        return 0.86;
      case "medium":
        return 0.72;
      case "low":
        return 0.6;
      default:
        return 0.7;
    }
  };

  const getOverallScore = (model: typeof allModels[number]) => {
    const accuracy = scoreFromLabel(model.accuracy);
    const speed = scoreFromLabel(model.speed);
    const cost = scoreFromLabel(model.costEfficiency);
    const score = accuracy * 0.5 + speed * 0.25 + cost * 0.25;
    return Math.round(score * 100);
  };

  const getPricing = (model: typeof allModels[number]) => {
    const tier = model.costEfficiency.toLowerCase();
    if (tier === "high") {
      return { input: "$0.15", output: "$0.60" };
    }
    if (tier === "low") {
      return { input: "$1.50", output: "$4.50" };
    }
    return { input: "$0.50", output: "$1.50" };
  };

  const getCapabilities = (model: typeof allModels[number]) => {
    const tags = new Set<string>();
    if (model.type === "Router") tags.add("routing");
    if (model.useCases.some((useCase) => /code|debug/i.test(useCase))) tags.add("function-calling");
    if (model.useCases.some((useCase) => /problem|homework|q&a/i.test(useCase))) tags.add("chat");
    if (model.strengths.some((strength) => /code|debug/i.test(strength))) tags.add("tools");
    tags.add("text-generation");
    if (model.speed.toLowerCase() === "fast") tags.add("streaming");
    return Array.from(tags);
  };

  const getCategoryScores = (model: typeof allModels[number], overallScore: number) => {
    const categories = Array.from(new Set([...model.strengths, ...model.useCases])).slice(0, 8);
    return categories.map((label, index) => {
      const variance = (index % 4) * 3 - 4;
      const score = Math.max(58, Math.min(99, overallScore + variance));
      return { label, score };
    });
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setShowComparison(false);
  };

  const quickSearchItems = [
    { label: "Fastest models", prompt: "Show me the fastest models" },
    { label: "Top performers", prompt: "Show me the top performing models overall" },
    { label: "Best for code", prompt: "What are the best models for coding?" },
    { label: "Reasoning", prompt: "What are the best reasoning models?" },
  ];

  const handleQuickSearch = (prompt: string) => {
    setDiscoveryInput(prompt);
    handleDiscoverySend(prompt);
  };

  const rankModelsForQuery = (query: string) => {
    const lower = query.toLowerCase();
    return allModels
      .map((model) => {
        let score = getOverallScore(model);
        const haystack = `${model.name} ${model.provider} ${model.routing} ${model.useCases.join(" ")} ${model.strengths.join(" ")} ${model.id}`.toLowerCase();
        if (lower.includes("code") || lower.includes("debug")) {
          if (haystack.includes("code") || haystack.includes("debug")) score += 15;
        }
        if (lower.includes("math") || lower.includes("physics") || lower.includes("reasoning")) {
          if (haystack.includes("math") || haystack.includes("reasoning")) score += 12;
        }
        if (lower.includes("writing") || lower.includes("essay")) {
          if (haystack.includes("writing") || haystack.includes("history")) score += 10;
        }
        if (lower.includes("vision") || lower.includes("image")) {
          if (haystack.includes("vision") || haystack.includes("image")) score += 14;
        }
        if (lower.includes("cheap") || lower.includes("cost")) {
          if (model.costEfficiency.toLowerCase() === "high") score += 12;
        }
        if (lower.includes("fast") || lower.includes("latency")) {
          if (model.speed.toLowerCase() === "fast") score += 10;
        }
        return { model, score };
      })
      .sort((a, b) => b.score - a.score);
  };

  const buildDiscoveryResponse = (query: string) => {
    const ranked = rankModelsForQuery(query);
    const recommendations = ranked.slice(0, 6).map((entry) => {
      const reasons = [
        entry.model.accuracy === "High" ? "High accuracy" : "Balanced accuracy",
        entry.model.speed === "Fast" ? "fast latency" : "steady latency",
        entry.model.costEfficiency === "High" ? "cost efficient" : "reliable value",
      ];
      return {
        id: entry.model.id,
        reason: reasons.join(" • "),
      };
    });
    const response =
      recommendations.length === 0
        ? "I couldn't find strong matches. Try specifying speed, cost, or a task like code or math."
        : `Here are the best fits from the Model Hub for “${query}.”`;
    return { response, recommendations };
  };

  const handleDiscoverySend = (prompt?: string) => {
    const input = (prompt ?? discoveryInput).trim();
    if (!input) return;
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: input,
    };
    const { response, recommendations } = buildDiscoveryResponse(input);
    const assistantMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant" as const,
      content: response,
      recommendations,
    };
    setDiscoveryMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDiscoveryInput("");
  };

  const handleFilterToRecommendations = (recommendations?: Array<{ id: string }>) => {
    if (!recommendations || recommendations.length === 0) return;
    setDiscoveryFilterIds(new Set(recommendations.map((item) => item.id)));
  };

  const handleAddTopToCompare = (recommendations?: Array<{ id: string }>, count = 3) => {
    if (!recommendations || recommendations.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      recommendations.slice(0, count).forEach((item) => next.add(item.id));
      return next;
    });
    setCompareBanner(`Added top ${Math.min(count, recommendations.length)} to compare`);
    setTimeout(() => setCompareBanner(null), 1600);
  };

  const handleOpenTopDetail = (recommendations?: Array<{ id: string }>) => {
    if (!recommendations || recommendations.length === 0) return;
    setActiveModelId(recommendations[0].id);
  };

  const saveCompareHistory = (question: string, results: typeof compareResults) => {
    const entryId =
      compareSessionId ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
    if (!compareSessionId) setCompareSessionId(entryId);
    const models = results.map((result) => result.model);
    const lastModel = models[0] ?? "Model Hub Compare";
    const nextEntries = upsertHistoryEntry({
      id: entryId,
      question,
      subject: "Model Hub Compare",
      model: lastModel,
      models: models.length > 0 ? models : ["Model Hub Compare"],
      transcript: [
        { role: "user", content: question },
        {
          role: "assistant",
          content: "",
          tools: {
            solveQuestions: results.map((result) => ({
              steps: result.steps,
              final: result.final,
              model: result.model,
              confidence: result.confidence,
              citations: [`Model: ${result.usedModel}`],
              durationMs: result.durationMs,
              gatewayNote: result.gatewayNote,
              selectionReason: result.selectionReason,
            })),
          },
        },
      ],
      mode: "fast",
      createdAt: new Date().toISOString(),
    });
    setHistoryEntries(nextEntries);
  };

  const runCompare = async () => {
    if (compareStatus === "loading") return;
    if (!compareQuestion.trim() || selectedModels.length === 0) return;
    setCompareStatus("loading");
    setShowComparison(true);
    try {
      setCompareResults([]);
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: compareQuestion,
          models: selectedModels.map((model) => model.id),
          mode: "fast",
          maxSameModel,
          attachments: [],
          streaming: responseSettings.streaming,
          temperature: responseSettings.temperature,
          maxTokens: responseSettings.maxTokens,
        }),
      });
      if (!response.ok || !response.body) throw new Error("Compare request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const order = selectedModels.map((model) => model.id);
      const nextResults: typeof compareResults = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = JSON.parse(trimmed) as { type: string; payload?: any };
          if (event.type === "result" && event.payload) {
            const payload = event.payload as {
              model: string;
              usedModel: string;
              final: string;
              steps: string[];
              confidence: number;
              durationMs: number;
              gatewayNote?: string;
              selectionReason?: string;
            };
            const existingIndex = nextResults.findIndex((item) => item.model === payload.model);
            if (existingIndex >= 0) {
              nextResults[existingIndex] = payload;
            } else {
              nextResults.push(payload);
            }
            const ordered = [...nextResults].sort(
              (a, b) => order.indexOf(a.model) - order.indexOf(b.model)
            );
            setCompareResults(ordered);
          }
        }
      }
      setCompareStatus("idle");
      saveCompareHistory(compareQuestion, nextResults);
    } catch {
      setCompareStatus("error");
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />

      <YStack
        flex={1}
        padding="$xl"
        maxWidth={1200}
        marginHorizontal="auto"
        width="100%"
      >
        <H1 fontSize={32} fontWeight="700" color="$color" marginBottom="$sm">
          Model Hub
        </H1>
        <Paragraph color="$textMuted" fontSize={16} maxWidth={720} marginBottom="$lg">
          Browse every model and router. Select multiple cards to compare them side by side.
        </Paragraph>


        <YStack gap="$sm" marginBottom="$lg">
          {([
            { key: "rankings", title: "Personalized model rankings" },
            { key: "instructor", title: "Instructor recommended models" },
            { key: "difference", title: "Explain the difference view" },
          ] as const).map((section) => (
            <YStack
              key={section.key}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              backgroundColor="$background"
            >
              <Button
                size="$3"
                backgroundColor="transparent"
                borderWidth={0}
                justifyContent="space-between"
                onPress={() =>
                  setInfoPanel((prev) => (prev === section.key ? null : section.key))
                }
              >
                <XStack alignItems="center" justifyContent="space-between" flex={1}>
                  <Text fontSize={13} color="$color">
                    {section.title}
                  </Text>
                  <Text fontSize={12} color="$textMuted">
                    {infoPanel === section.key ? "▾" : "▸"}
                  </Text>
                </XStack>
              </Button>

              {infoPanel === section.key && (
                <YStack padding="$md" gap="$xs">
                  {section.key === "rankings" &&
                    (personalizedRankings.length > 0 ? (
                      <YStack gap="$xs">
                        {personalizedRankings.map((entry, index) => (
                          <XStack key={entry.id} justifyContent="space-between" alignItems="center">
                            <Text fontSize={12} color="$color">
                              {index + 1}. {entry.name}
                            </Text>
                            <XStack gap="$sm" alignItems="center">
                              {typeof entry.avgConfidence === "number" && (
                                <Text fontSize={11} color="$textMuted">
                                  {(entry.avgConfidence * 100).toFixed(0)}%
                                </Text>
                              )}
                              <Text fontSize={11} color="$textMuted">
                                {entry.usageCount} runs
                              </Text>
                            </XStack>
                          </XStack>
                        ))}
                      </YStack>
                    ) : (
                      <Text fontSize={12} color="$textMuted">
                        Rankings appear after you use a few models.
                      </Text>
                    ))}

                  {section.key === "instructor" && (
                    <YStack gap="$sm">
                      {instructorRecommendations.map((rec) => (
                        <YStack key={rec.subject} gap={2}>
                          <Text fontSize={12} color="$color">
                            {rec.subject}
                          </Text>
                          <Text fontSize={11} color="$textMuted">
                            {rec.models
                              .map((modelId) => modelDisplayName.get(modelId) ?? modelId)
                              .join(", ")}
                          </Text>
                          <Text fontSize={11} color="$textMuted">
                            {rec.note}
                          </Text>
                        </YStack>
                      ))}
                    </YStack>
                  )}

                  {section.key === "difference" &&
                    (differenceSummary ? (
                      <YStack gap="$xs">
                        <Text fontSize={12} color="$color">
                          Most confident: {modelDisplayName.get(differenceSummary.bestConfidence.model) ?? differenceSummary.bestConfidence.model} (
                          {(differenceSummary.bestConfidence.confidence * 100).toFixed(0)}%)
                        </Text>
                        <Text fontSize={12} color="$color">
                          Fastest: {modelDisplayName.get(differenceSummary.fastest.model) ?? differenceSummary.fastest.model} (
                          {Math.round(differenceSummary.fastest.durationMs)} ms)
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Answer length range: {differenceSummary.wordRange[0]}-{differenceSummary.wordRange[1]} words
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Step count range: {differenceSummary.stepRange[0]}-{differenceSummary.stepRange[1]} steps
                        </Text>
                      </YStack>
                    ) : (
                      <Text fontSize={12} color="$textMuted">
                        Run a comparison to see how models answered differently.
                      </Text>
                    ))}
                </YStack>
              )}
            </YStack>
          ))}
        </YStack>

        <XStack gap="$lg" alignItems="flex-start" position="relative">
          <YStack
            width={260}
            minWidth={240}
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            padding="$md"
            backgroundColor="$background"
            gap="$md"
            position="sticky"
            top={90}
            alignSelf="flex-start"
          >
            <YStack gap={2}>
              <Text fontSize={16} fontWeight="700" color="$color">
                AI Model Discovery
              </Text>
              <Text fontSize={12} color="$textMuted">
                Ask me to find or compare models
              </Text>
            </YStack>

            <XStack gap="$xs" flexWrap="wrap">
              {quickSearchItems.map((item) => (
                <Button
                  key={item.label}
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="$border"
                  color="$color"
                  onPress={() => handleQuickSearch(item.prompt)}
                >
                  {item.label}
                </Button>
              ))}
            </XStack>

            <YStack
              flex={1}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              padding="$sm"
              backgroundColor="$backgroundSecondary"
              gap="$sm"
              overflow="scroll"
              maxHeight={compareMode ? 480 : 360}
            >
              {discoveryMessages.length === 0 ? (
                <YStack gap="$sm">
                  <Text fontSize={13} fontWeight="600" color="$color">
                    Find Your Perfect Model
                  </Text>
                  <Text fontSize={12} color="$textMuted">
                    Ask about speed, cost, reasoning, or use cases and I will surface the best fits.
                  </Text>
                </YStack>
              ) : (
                discoveryMessages.map((message) => (
                  <YStack
                    key={message.id}
                    gap="$xs"
                    alignSelf={message.role === "user" ? "flex-end" : "flex-start"}
                    maxWidth="100%"
                  >
                    <Text
                      fontSize={12}
                      color={message.role === "user" ? "$background" : "$color"}
                      padding="$sm"
                      borderRadius="$md"
                      backgroundColor={message.role === "user" ? "$color" : "$background"}
                    >
                      {message.content}
                    </Text>
                    {message.role === "assistant" && message.recommendations && (
                      <YStack gap={2}>
                        {message.recommendations.map((rec) => (
                          <XStack key={rec.id} justifyContent="space-between" gap="$xs">
                            <Text fontSize={11} color="$color">
                              {modelDisplayName.get(rec.id) ?? rec.id}
                            </Text>
                            <Text fontSize={11} color="$textMuted">
                              {rec.reason}
                            </Text>
                          </XStack>
                        ))}
                        <XStack gap="$xs" flexWrap="wrap" marginTop="$xs">
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor="$border"
                            color="$color"
                            onPress={() => handleFilterToRecommendations(message.recommendations)}
                          >
                            Filter list
                          </Button>
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor="$border"
                            color="$color"
                            onPress={() => handleAddTopToCompare(message.recommendations, 3)}
                          >
                            Add top 3 to Compare
                          </Button>
                          <Button
                            size="$1"
                            backgroundColor="transparent"
                            borderWidth={1}
                            borderColor="$border"
                            color="$color"
                            onPress={() => handleOpenTopDetail(message.recommendations)}
                          >
                            Open top model
                          </Button>
                        </XStack>
                      </YStack>
                    )}
                  </YStack>
                ))
              )}
            </YStack>

            <YStack gap="$xs">
              <TextArea
                value={compareMode ? compareQuestion : discoveryInput}
                onChangeText={compareMode ? setCompareQuestion : setDiscoveryInput}
                placeholder={compareMode ? "Compare prompt…" : "Ask about models…"}
                minHeight={compareMode ? 90 : 70}
                borderColor="$border"
                backgroundColor="$background"
                fontSize={13}
                padding="$sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (compareMode) {
                      runCompare();
                    } else {
                      handleDiscoverySend();
                    }
                  }
                }}
              />
              {compareMode && (
                <YStack gap="$xs" marginBottom="$xs">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={11} color="$textMuted">
                      Live streaming
                    </Text>
                    <Button
                      size="$1"
                      backgroundColor={responseSettings.streaming ? "$color" : "transparent"}
                      color={responseSettings.streaming ? "$background" : "$color"}
                      borderWidth={1}
                      borderColor="$border"
                      onPress={() =>
                        setResponseSettings((prev) => ({
                          ...prev,
                          streaming: !prev.streaming,
                        }))
                      }
                    >
                      {responseSettings.streaming ? "On" : "Off"}
                    </Button>
                  </XStack>
                  <YStack gap={2}>
                    <Text fontSize={11} color="$textMuted">
                      Temperature: {responseSettings.temperature.toFixed(1)}
                    </Text>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={responseSettings.temperature}
                      onChange={(event) =>
                        setResponseSettings((prev) => ({
                          ...prev,
                          temperature: Number(event.target.value),
                        }))
                      }
                    />
                  </YStack>
                  <YStack gap={2}>
                    <Text fontSize={11} color="$textMuted">
                      Max tokens: {responseSettings.maxTokens}
                    </Text>
                    <input
                      type="range"
                      min={200}
                      max={2400}
                      step={100}
                      value={responseSettings.maxTokens}
                      onChange={(event) =>
                        setResponseSettings((prev) => ({
                          ...prev,
                          maxTokens: Number(event.target.value),
                        }))
                      }
                    />
                  </YStack>
                </YStack>
              )}
              <XStack gap="$xs">
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  onPress={() => {
                    if (compareMode) {
                      runCompare();
                    } else {
                      handleDiscoverySend();
                    }
                  }}
                  disabled={compareMode && (compareStatus === "loading" || selectedModels.length === 0)}
                >
                  {compareMode ? (compareStatus === "loading" ? "Comparing..." : "Run Compare") : "Send"}
                </Button>
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="$border"
                  color="$color"
                  onPress={() => {
                    if (compareMode) {
                      setCompareMode(false);
                      return;
                    }
                    setCompareMode(true);
                    if (!compareQuestion && discoveryInput) setCompareQuestion(discoveryInput);
                  }}
                >
                  {compareMode ? "Back" : "Compare"}
                </Button>
              </XStack>
            </YStack>
          </YStack>

          <YStack flex={1} minWidth={0}>
            <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" marginBottom="$md">
              <Text fontSize={14} color="$textMuted">
                All models • Showing: {filteredModels.length} • Selected: {selectedModels.length}
              </Text>
              <XStack gap="$sm">
                <input
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search models..."
                  style={{
                    width: 220,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e5e5",
                    background: "#fff",
                    color: "#111",
                    fontSize: 12,
                  }}
                />
                <Button
                  size="$3"
                  backgroundColor={viewMode === "grid" ? "$color" : "transparent"}
                  color={viewMode === "grid" ? "$background" : "$color"}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$sm"
                  onPress={() => setViewMode("grid")}
                >
                  Grid
                </Button>
                <Button
                  size="$3"
                  backgroundColor={viewMode === "list" ? "$color" : "transparent"}
                  color={viewMode === "list" ? "$background" : "$color"}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$sm"
                  onPress={() => setViewMode("list")}
                >
                  List
                </Button>
              </XStack>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center" marginBottom="$sm">
              <Text fontSize={12} color="$textMuted">
                {selectedModels.length} Models Selected for Compare
              </Text>
              <XStack gap="$sm">
                {discoveryFilterIds && (
                  <Button
                    size="$2"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor="$border"
                    color="$color"
                    onPress={() => setDiscoveryFilterIds(null)}
                  >
                    Clear filter
                  </Button>
                )}
                {compareBanner && (
                  <Text fontSize={11} color="$textMuted">
                    {compareBanner}
                  </Text>
                )}
              </XStack>
            </XStack>

            {showComparison && selectedModels.length > 1 && (
              <YStack marginBottom="$md" gap="$sm" ref={compareSectionRef}>
                <Text fontSize={14} color="$textMuted">
                  Compare results
                </Text>
                {compareResults.length > 0 && (
                  <XStack gap="$lg" flexWrap="wrap">
                    {compareResults.map((result) => (
                      <YStack
                        key={`compare-result-${result.model}`}
                        flex={1}
                        minWidth={280}
                        borderWidth={1}
                        borderColor="$border"
                        borderRadius="$md"
                        padding="$lg"
                      >
                        <Text fontSize={14} fontWeight="600" color="$color" marginBottom="$xs">
                          {modelDisplayName.get(result.model) ?? result.model}
                        </Text>
                        <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                          Used: {modelDisplayName.get(result.usedModel) ?? result.usedModel}
                        </Text>
                        {result.selectionReason && (
                          <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                            Why selected: {result.selectionReason}
                          </Text>
                        )}
                        {result.gatewayNote && (
                          <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                            {result.gatewayNote}
                          </Text>
                        )}
                        <Text fontSize={13} color="$color" marginBottom="$sm">
                          {result.final}
                        </Text>
                        <XStack justifyContent="space-between" flexWrap="wrap">
                          <Text fontSize={12} color="$textMuted">
                            Confidence: {(result.confidence * 100).toFixed(0)}%
                          </Text>
                          <Text fontSize={12} color="$textMuted">
                            Latency: {Math.round(result.durationMs)} ms
                          </Text>
                        </XStack>
                      </YStack>
                    ))}
                  </XStack>
                )}
                <YStack borderWidth={1} borderColor="$border" borderRadius="$md">
                  <XStack
                    padding="$sm"
                    borderBottomWidth={1}
                    borderColor="$border"
                    backgroundColor="$backgroundSecondary"
                  >
                    <Text flex={2} fontSize={12} color="$textMuted">
                      Model
                    </Text>
                    <Text flex={1} fontSize={12} color="$textMuted">
                      Speed
                    </Text>
                    <Text flex={1} fontSize={12} color="$textMuted">
                      Accuracy
                    </Text>
                    <Text flex={1} fontSize={12} color="$textMuted">
                      Cost-efficiency
                    </Text>
                    <Text flex={2} fontSize={12} color="$textMuted">
                      Strengths
                    </Text>
                  </XStack>
                  {selectedModels.map((model) => (
                    <XStack
                      key={`compare-${model.id}`}
                      padding="$sm"
                      borderBottomWidth={1}
                      borderColor="$border"
                    >
                      <Text flex={2} fontSize={13} color="$color">
                        {model.name}
                      </Text>
                      <Text flex={1} fontSize={13} color="$color">
                        {model.speed}
                      </Text>
                      <Text flex={1} fontSize={13} color="$color">
                        {model.accuracy}
                      </Text>
                      <Text flex={1} fontSize={13} color="$color">
                        {model.costEfficiency}
                      </Text>
                      <Text flex={2} fontSize={13} color="$textMuted">
                        {model.strengths.join(", ")}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>
            )}

            {selectedModels.length > 1 && (
              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$sm"
                backgroundColor="$backgroundSecondary"
                marginBottom="$md"
              >
                <Text fontSize={12} color="$textMuted">
                  Selected models ({selectedModels.length})
                </Text>
                <XStack gap="$xs" flexWrap="wrap" marginTop="$xs">
                  {selectedModels.map((model) => (
                    <Text
                      key={`selected-${model.id}`}
                      fontSize={12}
                      color="$color"
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$full"
                      paddingHorizontal="$sm"
                      paddingVertical={4}
                    >
                      {model.name}
                    </Text>
                  ))}
                </XStack>
                <XStack gap="$sm" marginTop="$sm">
                  <Button
                    size="$3"
                    backgroundColor="transparent"
                    borderWidth={1}
                    borderColor="$border"
                    color="$color"
                    onPress={clearAll}
                  >
                    Clear all
                  </Button>
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  onPress={() => {
                    setCompareMode(true);
                    if (compareResults.length > 0) {
                      setShowComparison(true);
                      compareSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                >
                  Compare models
                </Button>
              </XStack>
            </YStack>
          )}

            {filteredModels.length === 0 ? (
              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$lg"
                backgroundColor="$backgroundSecondary"
                gap="$sm"
              >
                <Text fontSize={13} color="$color">
                  No models match that search.
                </Text>
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  onPress={() => setModelSearch("")}
                >
                  Clear search
                </Button>
              </YStack>
            ) : viewMode === "list" ? (
              <YStack gap="$lg">
                {filteredModels.map((model) => {
                  const isSelected = selectedIds.has(model.id);
                  const isActive = activeModelId === model.id;
                  return (
                    <YStack
                      key={model.id}
                      borderWidth={2}
                      borderColor={isActive ? "$color" : isSelected ? "$accent" : "$border"}
                      borderRadius="$md"
                      padding="$lg"
                      backgroundColor={isActive ? "$backgroundSecondary" : "$background"}
                      onPress={() => setActiveModelId(model.id)}
                    >
                      <XStack alignItems="center" justifyContent="space-between" marginBottom="$sm">
                        <Text fontSize={16} fontWeight="600" color="$color">
                          {model.name}
                        </Text>
                        <XStack gap="$sm" alignItems="center">
                          {isSelected && (
                            <Text fontSize={11} color="$textMuted">
                              In compare
                            </Text>
                          )}
                          <Text fontSize={12} color={model.status === "Active" ? "$success" : "$textMuted"}>
                            {model.status}
                          </Text>
                        </XStack>
                      </XStack>
                      <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                        {model.type} • {model.provider}
                      </Text>
                      <Text fontSize={13} color="$color" marginBottom="$sm">
                        {model.routing}
                      </Text>
                      <XStack gap="$xs" flexWrap="wrap" marginBottom="$sm">
                        {model.useCases.map((useCase) => (
                          <Text
                            key={`${model.id}-${useCase}`}
                            fontSize={12}
                            color="$color"
                            borderWidth={1}
                            borderColor="$border"
                            borderRadius="$full"
                            paddingHorizontal="$sm"
                            paddingVertical={4}
                          >
                            {useCase}
                          </Text>
                        ))}
                      </XStack>
                      <XStack gap="$xs" flexWrap="wrap" marginBottom="$sm">
                        {model.strengths.map((strength) => (
                          <Text
                            key={`${model.id}-${strength}`}
                            fontSize={12}
                            color="$textMuted"
                            borderWidth={1}
                            borderColor="$border"
                            borderRadius="$full"
                            paddingHorizontal="$sm"
                            paddingVertical={4}
                          >
                            {strength}
                          </Text>
                        ))}
                      </XStack>
                      <XStack justifyContent="space-between" flexWrap="wrap">
                        <Text fontSize={12} color="$textMuted">
                          Speed: {model.speed}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Accuracy: {model.accuracy}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Cost: {model.costEfficiency}
                        </Text>
                      </XStack>
                      <XStack justifyContent="space-between" flexWrap="wrap" marginTop="$xs">
                        <Text fontSize={12} color="$textMuted">
                          Availability: {model.availability}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Latency: {model.latency}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Reliability: {model.reliability}
                        </Text>
                      </XStack>
                    </YStack>
                  );
                })}
              </YStack>
            ) : (
              <XStack gap="$lg" flexWrap="wrap">
                {filteredModels.map((model) => {
                  const isSelected = selectedIds.has(model.id);
                  const isActive = activeModelId === model.id;
                  return (
                    <YStack
                      key={model.id}
                      flex={1}
                      minWidth={280}
                      borderWidth={2}
                      borderColor={isActive ? "$color" : isSelected ? "$accent" : "$border"}
                      borderRadius="$md"
                      padding="$lg"
                      backgroundColor={isActive ? "$backgroundSecondary" : "$background"}
                      onPress={() => setActiveModelId(model.id)}
                    >
                      <XStack alignItems="center" justifyContent="space-between" marginBottom="$sm">
                        <Text fontSize={16} fontWeight="600" color="$color">
                          {model.name}
                        </Text>
                        <XStack gap="$sm" alignItems="center">
                          {isSelected && (
                            <Text fontSize={11} color="$textMuted">
                              In compare
                            </Text>
                          )}
                          <Text fontSize={12} color={model.status === "Active" ? "$success" : "$textMuted"}>
                            {model.status}
                          </Text>
                        </XStack>
                      </XStack>
                      <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                        {model.type} • {model.provider}
                      </Text>
                      <Text fontSize={13} color="$color" marginBottom="$sm">
                        {model.routing}
                      </Text>
                      <XStack gap="$xs" flexWrap="wrap" marginBottom="$sm">
                        {model.useCases.map((useCase) => (
                          <Text
                            key={`${model.id}-${useCase}`}
                            fontSize={12}
                            color="$color"
                            borderWidth={1}
                            borderColor="$border"
                            borderRadius="$full"
                            paddingHorizontal="$sm"
                            paddingVertical={4}
                          >
                            {useCase}
                          </Text>
                        ))}
                      </XStack>
                      <XStack gap="$xs" flexWrap="wrap" marginBottom="$sm">
                        {model.strengths.map((strength) => (
                          <Text
                            key={`${model.id}-${strength}`}
                            fontSize={12}
                            color="$textMuted"
                            borderWidth={1}
                            borderColor="$border"
                            borderRadius="$full"
                            paddingHorizontal="$sm"
                            paddingVertical={4}
                          >
                            {strength}
                          </Text>
                        ))}
                      </XStack>
                      <XStack justifyContent="space-between" flexWrap="wrap">
                        <Text fontSize={12} color="$textMuted">
                          Speed: {model.speed}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Accuracy: {model.accuracy}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Cost: {model.costEfficiency}
                        </Text>
                      </XStack>
                      <XStack justifyContent="space-between" flexWrap="wrap" marginTop="$xs">
                        <Text fontSize={12} color="$textMuted">
                          Availability: {model.availability}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Latency: {model.latency}
                        </Text>
                        <Text fontSize={12} color="$textMuted">
                          Reliability: {model.reliability}
                        </Text>
                      </XStack>
                    </YStack>
                  );
                })}
              </XStack>
            )}
          </YStack>

          {activeModel && (
            <YStack
              ref={detailPanelRef}
              tabIndex={-1}
              width={isNarrow ? "100%" : 360}
              minHeight={isNarrow ? "100%" : 520}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              padding="$lg"
              backgroundColor="$background"
              position={isNarrow ? "absolute" : "sticky"}
              top={isNarrow ? 0 : 90}
              right={isNarrow ? 0 : undefined}
              bottom={isNarrow ? 0 : undefined}
              zIndex={isNarrow ? 20 : undefined}
              shadowColor="rgba(0,0,0,0.2)"
              shadowOpacity={isNarrow ? 0.2 : 0}
              shadowRadius={isNarrow ? 12 : 0}
              overflow="hidden"
              gap="$md"
            >
              <XStack justifyContent="space-between" alignItems="flex-start" gap="$sm">
                <YStack gap="$xs">
                  <Text fontSize={18} fontWeight="700" color="$color">
                    {activeModel.name}
                  </Text>
                  <Text fontSize={12} color="$textMuted">
                    {activeModel.provider}
                  </Text>
                  {(() => {
                    const rank = allModels.findIndex((model) => model.id === activeModel.id);
                    if (rank === -1) return null;
                    return (
                      <Text fontSize={11} color="$textMuted">
                        Leaderboard rank #{rank + 1}
                      </Text>
                    );
                  })()}
                </YStack>
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={0}
                  color="$textMuted"
                  onPress={() => setActiveModelId(null)}
                >
                  <X size={16} />
                </Button>
              </XStack>

              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$md"
                backgroundColor="$backgroundSecondary"
                gap="$xs"
              >
                <Text fontSize={12} color="$textMuted">
                  Overall Score
                </Text>
                <Text fontSize={28} fontWeight="700" color="$color">
                  {getOverallScore(activeModel)}%
                </Text>
              </YStack>

              <YStack gap="$xs">
                <Text fontSize={12} color="$textMuted">
                  Pricing (per 1M tokens)
                </Text>
                {(() => {
                  const pricing = getPricing(activeModel);
                  return (
                    <YStack gap={2}>
                      <Text fontSize={13} color="$color">
                        Input: {pricing.input}
                      </Text>
                      <Text fontSize={13} color="$color">
                        Output: {pricing.output}
                      </Text>
                    </YStack>
                  );
                })()}
              </YStack>

              <YStack gap="$xs">
                <Text fontSize={12} color="$textMuted">
                  Capabilities
                </Text>
                <XStack gap="$xs" flexWrap="wrap">
                  {getCapabilities(activeModel).map((capability) => (
                    <Text
                      key={`${activeModel.id}-${capability}`}
                      fontSize={11}
                      color="$color"
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$full"
                      paddingHorizontal="$sm"
                      paddingVertical={4}
                    >
                      {capability}
                    </Text>
                  ))}
                </XStack>
              </YStack>

              <YStack gap="$xs" flex={1}>
                <Text fontSize={12} color="$textMuted">
                  Category scores
                </Text>
                <YStack
                  gap="$xs"
                  flex={1}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$md"
                  padding="$sm"
                  backgroundColor="$backgroundSecondary"
                  overflow="scroll"
                  maxHeight={isNarrow ? "100%" : 220}
                >
                  {getCategoryScores(activeModel, getOverallScore(activeModel)).map((item) => (
                    <XStack key={`${activeModel.id}-${item.label}`} justifyContent="space-between">
                      <Text fontSize={12} color="$color">
                        {item.label}
                      </Text>
                      <Text fontSize={12} color="$textMuted">
                        {item.score}%
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>

              <YStack
                gap="$sm"
                paddingTop="$sm"
                borderTopWidth={1}
                borderColor="$border"
                backgroundColor="$background"
                position="sticky"
                bottom={0}
              >
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  onPress={() => handleDeployToStudio(activeModel.id)}
                >
                  Deploy to Studio
                </Button>
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="$border"
                  color="$color"
                  onPress={() => toggleSelection(activeModel.id)}
                >
                  {selectedIds.has(activeModel.id) ? "Remove from Compare" : "Add to Compare"}
                </Button>
              </YStack>
            </YStack>
          )}
        </XStack>

      </YStack>
    </YStack>
  );
}
