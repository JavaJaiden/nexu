export type LabPreset = {
  id: string;
  name: string;
  models: string[];
  subject?: string;
  tags?: string[];
  createdAt: string;
};

export type LabExperiment = {
  id: string;
  question: string;
  models: string[];
  createdAt: string;
  subject?: string;
  bestModel?: string;
  score?: number;
  notes?: Record<string, string>;
  votes?: Record<string, number>;
};

export type LabCombinationSummary = {
  key: string;
  subject: string;
  models: string[];
  runs: number;
  wins: number;
  winRate: number;
  avgScore?: number;
  bestModel?: string;
  bestModelBreakdown: Array<{ modelId: string; count: number }>;
  lastRunAt: string;
};

const PRESETS_KEY = "nexus_lab_presets_v1";
const EXPERIMENTS_KEY = "nexus_lab_experiments_v1";
const LAB_PRESETS_UPDATED_EVENT = "lab-presets-updated";
const LAB_EXPERIMENTS_UPDATED_EVENT = "lab-experiments-updated";

function normalizeSubject(subject?: string) {
  const value = (subject ?? "").trim();
  return value.length > 0 ? value : "General";
}

function normalizeModelIds(models: string[]) {
  return Array.from(
    new Set(models.filter((modelId) => typeof modelId === "string" && modelId.trim().length > 0))
  );
}

function normalizeTags(tags?: string[]) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function normalizeScore(score: number | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(1, score));
}

function getCombinationKey(models: string[]) {
  return [...models].sort((a, b) => a.localeCompare(b)).join("|");
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadLabPresets(): LabPreset[] {
  const presets = readJson<LabPreset[]>(PRESETS_KEY, []);
  if (!Array.isArray(presets)) return [];
  return presets
    .filter(
      (preset): preset is LabPreset =>
        Boolean(
          preset &&
            typeof preset.id === "string" &&
            typeof preset.name === "string" &&
            Array.isArray(preset.models) &&
            typeof preset.createdAt === "string"
        )
    )
    .map((preset) => ({
      ...preset,
      name: preset.name.trim() || "Untitled preset",
      models: normalizeModelIds(preset.models),
      subject: normalizeSubject(preset.subject),
      tags: normalizeTags(preset.tags),
    }))
    .filter((preset) => preset.models.length > 0);
}

export function saveLabPresets(presets: LabPreset[]) {
  writeJson(PRESETS_KEY, presets);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LAB_PRESETS_UPDATED_EVENT));
  }
}

export function upsertLabPreset(preset: LabPreset) {
  const normalizedPreset: LabPreset = {
    ...preset,
    name: preset.name.trim() || "Untitled preset",
    models: normalizeModelIds(preset.models),
    subject: normalizeSubject(preset.subject),
    tags: normalizeTags(preset.tags),
  };
  if (normalizedPreset.models.length === 0) {
    return loadLabPresets();
  }

  const presets = loadLabPresets();
  const filtered = presets.filter((item) => item.id !== normalizedPreset.id);
  const next = [normalizedPreset, ...filtered].slice(0, 50);
  saveLabPresets(next);
  return next;
}

export function removeLabPreset(id: string) {
  const presets = loadLabPresets();
  const next = presets.filter((item) => item.id !== id);
  saveLabPresets(next);
  return next;
}

export function loadLabExperiments(): LabExperiment[] {
  const experiments = readJson<LabExperiment[]>(EXPERIMENTS_KEY, []);
  if (!Array.isArray(experiments)) return [];
  return experiments
    .filter(
      (experiment): experiment is LabExperiment =>
        Boolean(
          experiment &&
            typeof experiment.id === "string" &&
            typeof experiment.question === "string" &&
            Array.isArray(experiment.models) &&
            typeof experiment.createdAt === "string"
        )
    )
    .map((experiment) => {
      const models = normalizeModelIds(experiment.models);
      return {
        ...experiment,
        subject: normalizeSubject(experiment.subject),
        models,
        bestModel:
          typeof experiment.bestModel === "string" && models.includes(experiment.bestModel)
            ? experiment.bestModel
            : undefined,
        score: normalizeScore(experiment.score),
      };
    });
}

export function saveLabExperiments(experiments: LabExperiment[]) {
  writeJson(EXPERIMENTS_KEY, experiments);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LAB_EXPERIMENTS_UPDATED_EVENT));
  }
}

export function upsertLabExperiment(experiment: LabExperiment) {
  const experiments = loadLabExperiments();
  const filtered = experiments.filter((item) => item.id !== experiment.id);
  const next = [experiment, ...filtered].slice(0, 200);
  saveLabExperiments(next);
  return next;
}

export function recordLabExperiment(input: {
  id?: string;
  question: string;
  models: string[];
  createdAt?: string;
  subject?: string;
  bestModel?: string;
  score?: number;
  notes?: Record<string, string>;
  votes?: Record<string, number>;
}) {
  const models = normalizeModelIds(input.models);
  if (models.length === 0) {
    return loadLabExperiments();
  }

  const experiment: LabExperiment = {
    id:
      input.id ??
      (typeof crypto !== "undefined" ? crypto.randomUUID() : `exp-${Date.now()}`),
    question: input.question.trim() || "Untitled experiment",
    models,
    createdAt: input.createdAt ?? new Date().toISOString(),
    subject: normalizeSubject(input.subject),
    bestModel:
      typeof input.bestModel === "string" && models.includes(input.bestModel)
        ? input.bestModel
        : undefined,
    score: normalizeScore(input.score),
    notes: input.notes,
    votes: input.votes,
  };

  return upsertLabExperiment(experiment);
}

export function summarizeLabCombinations(
  experiments: LabExperiment[],
  subject?: string,
  limit = 5
) {
  const scopedSubject = subject ? normalizeSubject(subject).toLowerCase() : null;

  const summaryByCombination = new Map<
    string,
    {
      subject: string;
      models: string[];
      runs: number;
      wins: number;
      scoreTotal: number;
      scoreCount: number;
      bestModelCounts: Map<string, number>;
      lastRunAt: string;
    }
  >();

  experiments.forEach((experiment) => {
    const normalizedSubject = normalizeSubject(experiment.subject);
    if (scopedSubject && normalizedSubject.toLowerCase() !== scopedSubject) return;

    const models = normalizeModelIds(experiment.models);
    if (models.length === 0) return;

    const key = getCombinationKey(models);
    const existing = summaryByCombination.get(key) ?? {
      subject: normalizedSubject,
      models,
      runs: 0,
      wins: 0,
      scoreTotal: 0,
      scoreCount: 0,
      bestModelCounts: new Map<string, number>(),
      lastRunAt: experiment.createdAt,
    };

    existing.runs += 1;

    if (typeof experiment.bestModel === "string" && models.includes(experiment.bestModel)) {
      existing.wins += 1;
      existing.bestModelCounts.set(
        experiment.bestModel,
        (existing.bestModelCounts.get(experiment.bestModel) ?? 0) + 1
      );
    }

    const score = normalizeScore(experiment.score);
    if (typeof score === "number") {
      existing.scoreTotal += score;
      existing.scoreCount += 1;
    }

    if (new Date(experiment.createdAt).getTime() > new Date(existing.lastRunAt).getTime()) {
      existing.lastRunAt = experiment.createdAt;
    }

    summaryByCombination.set(key, existing);
  });

  const summaries = Array.from(summaryByCombination.entries()).map(([key, value]) => {
    const bestModelBreakdown = Array.from(value.bestModelCounts.entries())
      .map(([modelId, count]) => ({ modelId, count }))
      .sort((left, right) => right.count - left.count);
    const bestModel = bestModelBreakdown[0]?.modelId;

    const winRate = value.runs > 0 ? value.wins / value.runs : 0;
    const avgScore = value.scoreCount > 0 ? value.scoreTotal / value.scoreCount : undefined;

    return {
      key,
      subject: value.subject,
      models: value.models,
      runs: value.runs,
      wins: value.wins,
      winRate,
      avgScore,
      bestModel,
      bestModelBreakdown,
      lastRunAt: value.lastRunAt,
    } satisfies LabCombinationSummary;
  });

  summaries.sort((left, right) => {
    if (right.winRate !== left.winRate) return right.winRate - left.winRate;
    if (right.runs !== left.runs) return right.runs - left.runs;
    return (right.avgScore ?? -1) - (left.avgScore ?? -1);
  });

  return summaries.slice(0, Math.max(1, limit));
}

export function getBestLabCombinations(subject?: string, limit = 5) {
  return summarizeLabCombinations(loadLabExperiments(), subject, limit);
}
