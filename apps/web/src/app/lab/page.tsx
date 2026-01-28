"use client";

import Header from "@/components/Header";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, H1, Paragraph, Text, TextArea, XStack, YStack } from "tamagui";
import { Paperclip, X } from "lucide-react";
import {
  loadLabExperiments,
  loadLabPresets,
  removeLabPreset,
  upsertLabExperiment,
  upsertLabPreset,
  type LabExperiment,
  type LabPreset,
} from "@/lib/labStore";
import { externalProviders, getModelHubCards, routerModels } from "@/lib/modelCatalog";
import type { PdfAttachment } from "@/lib/externalContext";
import { fileToAttachment, isPdfFile } from "@/lib/attachments";
import AgentPicker from "@/components/AgentPicker";


const subjects = [
  "General",
  "Mathematics",
  "Physics",
  "Computer Science",
  "Writing",
  "History",
];

type CompareResult = {
  model: string;
  usedModel: string;
  final: string;
  steps: string[];
  confidence: number;
  durationMs: number;
  gatewayNote?: string;
  selectionReason?: string;
};

type ConsensusResult = {
  model: string;
  final: string;
  steps: string[];
  confidence: number;
  durationMs: number;
  gatewayNote?: string;
  selectionReason?: string;
};

export default function LabPage() {
  const allModels = useMemo(() => {
    const externalModels = externalProviders.flatMap((provider) =>
      provider.models.map((model) => ({
        id: model.id,
        name: model.name,
        type: "Model",
        provider: provider.label,
      }))
    );
    const routerCards = routerModels.map((router) => ({
      id: router.id,
      name: router.name,
      type: "Router",
      provider: router.provider,
    }));
    return [...routerCards, ...externalModels];
  }, []);

  const modelCatalog = useMemo(() => getModelHubCards(), []);

  const modelNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allModels.forEach((model) => map.set(model.id, model.name));
    return map;
  }, [allModels]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modelSearch, setModelSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<PdfAttachment[]>([]);
  const [mode, setMode] = useState<"fast" | "deep">("fast");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [results, setResults] = useState<CompareResult[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [autoConsensus, setAutoConsensus] = useState(true);
  const [aggregatorModel, setAggregatorModel] = useState("auto");
  const [presetName, setPresetName] = useState("");
  const [presetSubject, setPresetSubject] = useState("General");
  const [presets, setPresets] = useState<LabPreset[]>([]);
  const [experiments, setExperiments] = useState<LabExperiment[]>([]);
  const [currentExperimentId, setCurrentExperimentId] = useState<string | null>(null);
  const [bestModel, setBestModel] = useState<string | null>(null);
  const [modelNotes, setModelNotes] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPresets(loadLabPresets());
    setExperiments(loadLabExperiments());
  }, []);

  const selectedModels = useMemo(
    () => allModels.filter((model) => selectedIds.has(model.id)),
    [allModels, selectedIds]
  );

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return allModels;
    return allModels.filter((model) => {
      const haystack = `${model.name} ${model.provider} ${model.type}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [allModels, modelSearch]);

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
  };

  const savePreset = () => {
    if (!presetName.trim() || selectedModels.length === 0) return;
    const preset: LabPreset = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      name: presetName.trim(),
      models: selectedModels.map((model) => model.id),
      subject: presetSubject,
      createdAt: new Date().toISOString(),
    };
    const nextPresets = upsertLabPreset(preset);
    setPresets(nextPresets);
    setPresetName("");
  };

  const handleUsePreset = (preset: LabPreset) => {
    setSelectedIds(new Set(preset.models));
  };

  const handleDeletePreset = (id: string) => {
    const nextPresets = removeLabPreset(id);
    setPresets(nextPresets);
  };

  const upsertExperiment = (updates: Partial<LabExperiment>) => {
    if (!currentExperimentId) return;
    const existing =
      experiments.find((entry) => entry.id === currentExperimentId) ??
      ({
        id: currentExperimentId,
        question,
        models: selectedModels.map((model) => model.id),
        createdAt: new Date().toISOString(),
      } as LabExperiment);
    const next = upsertLabExperiment({
      ...existing,
      ...updates,
    });
    setExperiments(next);
  };

  const handleVote = (modelId: string) => {
    setBestModel(modelId);
    upsertExperiment({ bestModel: modelId });
  };

  const handleNoteChange = (modelId: string, value: string) => {
    setModelNotes((prev) => {
      const next = { ...prev, [modelId]: value };
      upsertExperiment({ notes: next });
      return next;
    });
  };

  const runConsensus = async (
    questionText: string,
    answers: CompareResult[],
    nextAttachments: PdfAttachment[]
  ) => {
    if (!autoConsensus || answers.length === 0) return;
    const response = await fetch("/api/consensus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionText,
        answers: answers.map((answer) => ({
          model: answer.usedModel ?? answer.model,
          final: answer.final,
        })),
        aggregatorModel: aggregatorModel === "auto" ? undefined : aggregatorModel,
        attachments: nextAttachments,
      }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as ConsensusResult;
    setConsensus(payload);
  };

  const runExperiment = async () => {
    if (!question.trim() || selectedModels.length < 2) return;
    setStatus("loading");
    setResults([]);
    setConsensus(null);
    setBestModel(null);
    setModelNotes({});

    const experimentId =
      typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now());
    setCurrentExperimentId(experimentId);
    const initialExperiment: LabExperiment = {
      id: experimentId,
      question: question.trim(),
      models: selectedModels.map((model) => model.id),
      createdAt: new Date().toISOString(),
    };
    setExperiments(upsertLabExperiment(initialExperiment));

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          models: selectedModels.map((model) => model.id),
          mode,
          attachments,
        }),
      });
      if (!response.ok || !response.body) throw new Error("Compare failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const order = selectedModels.map((model) => model.id);
      const nextResults: CompareResult[] = [];

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
            const payload = event.payload as CompareResult;
            const existingIndex = nextResults.findIndex((item) => item.model === payload.model);
            if (existingIndex >= 0) {
              nextResults[existingIndex] = payload;
            } else {
              nextResults.push(payload);
            }
            const ordered = [...nextResults].sort(
              (a, b) => order.indexOf(a.model) - order.indexOf(b.model)
            );
            setResults(ordered);
          }
        }
      }

      setStatus("idle");
      await runConsensus(question.trim(), nextResults, attachments);
      setAttachments([]);
    } catch {
      setStatus("error");
    }
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: PdfAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!isPdfFile(file)) continue;
      try {
        const attachment = await fileToAttachment(file);
        next.push(attachment);
      } catch {
        // ignore
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />

      <YStack flex={1} padding="$xl" maxWidth={1200} marginHorizontal="auto" width="100%">
        <H1 fontSize={32} fontWeight="700" color="$color" marginBottom="$sm">
          Laboratory
        </H1>
        <Paragraph color="$textMuted" fontSize={16} maxWidth={720} marginBottom="$lg">
          Pair and compare multiple models, save stacks, and experiment with consensus answers.
        </Paragraph>

        <YStack gap="$lg">
          <YStack
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            padding="$md"
            backgroundColor="$background"
          >
            <Text fontSize={12} color="$textMuted" marginBottom="$xs">
              Model pairing ({selectedModels.length} selected)
            </Text>
            <input
              value={modelSearch}
              onChange={(event) => setModelSearch(event.target.value)}
              placeholder="Search models..."
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                background: "#fff",
                color: "#111",
                fontSize: 12,
                marginBottom: 10,
              }}
            />
            <XStack gap="$sm" flexWrap="wrap">
              {filteredModels.map((model) => {
                const isSelected = selectedIds.has(model.id);
                return (
                  <Button
                    key={model.id}
                    size="$2"
                    borderWidth={1}
                    borderColor="$border"
                    backgroundColor={isSelected ? "$color" : "transparent"}
                    color={isSelected ? "$background" : "$color"}
                    borderRadius="$full"
                    onPress={() => toggleSelection(model.id)}
                  >
                    {model.name}
                  </Button>
                );
              })}
            </XStack>
            {filteredModels.length === 0 && (
              <YStack marginTop="$sm" gap="$xs">
                <Text fontSize={12} color="$textMuted">
                  No models match that search.
                </Text>
                <Button
                  size="$2"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="$border"
                  color="$color"
                  borderRadius="$sm"
                  onPress={() => setModelSearch("")}
                >
                  Clear search
                </Button>
              </YStack>
            )}
          </YStack>

          <XStack gap="$lg" flexWrap="wrap">
            <YStack flex={2} minWidth={320}>
              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$sm"
                backgroundColor="$background"
              >
                <TextArea
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Ask a question to test your stack..."
                  minHeight={90}
                  borderColor="transparent"
                  backgroundColor="transparent"
                  fontSize={15}
                  padding="$sm"
                />
                {attachments.length > 0 && (
                  <XStack flexWrap="wrap" gap="$xs" paddingHorizontal="$xs" marginBottom="$xs">
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
                          onPress={() =>
                            setAttachments((prev) =>
                              prev.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          <X size={12} />
                        </Button>
                      </XStack>
                    ))}
                  </XStack>
                )}
                <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$sm">
                  <XStack gap="$sm">
                    <Button
                      size="$3"
                      backgroundColor={mode === "fast" ? "$color" : "transparent"}
                      color={mode === "fast" ? "$background" : "$color"}
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$sm"
                      onPress={() => setMode("fast")}
                    >
                      Fast
                    </Button>
                    <Button
                      size="$3"
                      backgroundColor={mode === "deep" ? "$color" : "transparent"}
                      color={mode === "deep" ? "$background" : "$color"}
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$sm"
                      onPress={() => setMode("deep")}
                    >
                      Deep
                    </Button>
                  </XStack>
                  <XStack gap="$sm" alignItems="center">
                    <Button
                      size="$3"
                      backgroundColor="$color"
                      color="$background"
                      borderRadius="$sm"
                      onPress={runExperiment}
                      disabled={status === "loading" || selectedModels.length < 2}
                    >
                      {status === "loading" ? "Running..." : "Run experiment"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={(event) => {
                        void handleAttachFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                    <Button
                      size="$3"
                      backgroundColor="transparent"
                      borderWidth={1}
                      borderColor="$border"
                      color="$color"
                      borderRadius="$sm"
                      icon={<Paperclip size={14} color="#9CA3AF" />}
                      onPress={() => fileInputRef.current?.click()}
                    >
                      Upload PDF
                    </Button>
                  </XStack>
                </XStack>
              </YStack>
            </YStack>

            <YStack flex={1} minWidth={260} gap="$sm">
              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$md"
                backgroundColor="$background"
              >
                <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                  Auto-consensus
                </Text>
                <XStack alignItems="center" gap="$sm" marginBottom="$sm">
                  <Button
                    size="$2"
                    backgroundColor={autoConsensus ? "$color" : "transparent"}
                    color={autoConsensus ? "$background" : "$color"}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$sm"
                    onPress={() => setAutoConsensus((prev) => !prev)}
                  >
                    {autoConsensus ? "Enabled" : "Disabled"}
                  </Button>
                </XStack>
                <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                  Aggregator model
                </Text>
                <AgentPicker
                  value={aggregatorModel}
                  onChange={setAggregatorModel}
                  models={modelCatalog}
                />
              </YStack>

              <YStack
                borderWidth={1}
                borderColor="$border"
                borderRadius="$md"
                padding="$md"
                backgroundColor="$background"
              >
                <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                  Save model stack
                </Text>
                <TextArea
                  value={presetName}
                  onChangeText={setPresetName}
                  placeholder="Preset name..."
                  minHeight={40}
                  borderColor="transparent"
                  backgroundColor="transparent"
                  fontSize={14}
                  padding="$xs"
                />
                <select
                  value={presetSubject}
                  onChange={(event) => setPresetSubject(event.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e5e5",
                    background: "#fff",
                    color: "#111",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                <Button
                  size="$3"
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$sm"
                  marginTop="$sm"
                  onPress={savePreset}
                  disabled={!presetName.trim() || selectedModels.length === 0}
                >
                  Save stack
                </Button>
              </YStack>
            </YStack>
          </XStack>

          {results.length > 0 && (
            <YStack gap="$sm">
              <Text fontSize={12} color="$textMuted">
                Parallel output view
              </Text>
              <XStack gap="$lg" flexWrap="wrap">
                {results.map((result) => (
                  <YStack
                    key={`lab-result-${result.model}`}
                    flex={1}
                    minWidth={280}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$md"
                    padding="$lg"
                  >
                    <Text fontSize={14} fontWeight="600" color="$color" marginBottom="$xs">
                      {modelNameMap.get(result.model) ?? result.model}
                    </Text>
                    <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                      Used: {modelNameMap.get(result.usedModel) ?? result.usedModel}
                    </Text>
                    <Text fontSize={13} color="$color" marginBottom="$sm">
                      {result.final}
                    </Text>
                    <YStack gap="$xs" marginBottom="$sm">
                      {result.steps.map((step, index) => (
                        <XStack key={`${result.model}-step-${index}`} gap="$sm" alignItems="flex-start">
                          <Text fontSize={12} color="$textMuted">
                            {index + 1}.
                          </Text>
                          <Text fontSize={13} color="$color">
                            {step}
                          </Text>
                        </XStack>
                      ))}
                    </YStack>
                    <XStack justifyContent="space-between" flexWrap="wrap" marginBottom="$sm">
                      <Text fontSize={12} color="$textMuted">
                        Confidence: {(result.confidence * 100).toFixed(0)}%
                      </Text>
                      <Text fontSize={12} color="$textMuted">
                        Latency: {Math.round(result.durationMs)} ms
                      </Text>
                    </XStack>
                    <Button
                      size="$2"
                      backgroundColor={bestModel === result.model ? "$color" : "transparent"}
                      color={bestModel === result.model ? "$background" : "$color"}
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$sm"
                      onPress={() => handleVote(result.model)}
                    >
                      {bestModel === result.model ? "Best answer" : "Mark best"}
                    </Button>
                    <TextArea
                      value={modelNotes[result.model] ?? ""}
                      onChangeText={(value) => handleNoteChange(result.model, value)}
                      placeholder="Performance notes..."
                      minHeight={50}
                      borderColor="$border"
                      backgroundColor="$backgroundSecondary"
                      fontSize={12}
                      padding="$xs"
                      marginTop="$sm"
                    />
                  </YStack>
                ))}
              </XStack>
            </YStack>
          )}

          {consensus && (
            <YStack
              borderWidth={1}
              borderColor="$border"
              borderRadius="$md"
              padding="$md"
              backgroundColor="$backgroundSecondary"
            >
              <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                Auto-consensus result
              </Text>
              <Text fontSize={14} fontWeight="600" color="$color" marginBottom="$xs">
                {consensus.final}
              </Text>
              <Text fontSize={12} color="$textMuted">
                Model: {consensus.model}
              </Text>
              <Text fontSize={12} color="$textMuted">
                Confidence: {(consensus.confidence * 100).toFixed(0)}%
              </Text>
            </YStack>
          )}

          <YStack gap="$sm">
            <Text fontSize={12} color="$textMuted">
              Saved presets
            </Text>
            {presets.length === 0 ? (
              <Text fontSize={12} color="$textMuted">
                No saved stacks yet.
              </Text>
            ) : (
              <XStack gap="$sm" flexWrap="wrap">
                {presets.map((preset) => (
                  <YStack
                    key={preset.id}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$md"
                    padding="$sm"
                    minWidth={240}
                  >
                    <Text fontSize={14} fontWeight="600" color="$color">
                      {preset.name}
                    </Text>
                    <Text fontSize={12} color="$textMuted" marginBottom="$xs">
                      {preset.subject ?? "General"}
                    </Text>
                    <Text fontSize={12} color="$textMuted" marginBottom="$sm">
                      {preset.models.map((model) => modelNameMap.get(model) ?? model).join(", ")}
                    </Text>
                    <XStack gap="$sm">
                      <Button
                        size="$2"
                        borderWidth={1}
                        borderColor="$border"
                        backgroundColor="transparent"
                        color="$color"
                        borderRadius="$sm"
                        onPress={() => handleUsePreset(preset)}
                      >
                        Use
                      </Button>
                      <Button
                        size="$2"
                        borderWidth={1}
                        borderColor="$border"
                        backgroundColor="transparent"
                        color="$color"
                        borderRadius="$sm"
                        onPress={() => handleDeletePreset(preset.id)}
                      >
                        Delete
                      </Button>
                    </XStack>
                  </YStack>
                ))}
              </XStack>
            )}
          </YStack>

          <YStack gap="$sm">
            <Text fontSize={12} color="$textMuted">
              Experiment history
            </Text>
            {experiments.length === 0 ? (
              <Text fontSize={12} color="$textMuted">
                No experiments yet.
              </Text>
            ) : (
              <YStack gap="$xs">
                {experiments.slice(0, 6).map((experiment) => (
                  <YStack
                    key={experiment.id}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$md"
                    padding="$sm"
                  >
                    <Text fontSize={13} color="$color" marginBottom="$xs">
                      {experiment.question}
                    </Text>
                    <Text fontSize={12} color="$textMuted">
                      Models: {experiment.models.map((model) => modelNameMap.get(model) ?? model).join(", ")}
                    </Text>
                    {experiment.bestModel && (
                      <Text fontSize={12} color="$textMuted">
                        Best: {modelNameMap.get(experiment.bestModel) ?? experiment.bestModel}
                      </Text>
                    )}
                  </YStack>
                ))}
              </YStack>
            )}
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
