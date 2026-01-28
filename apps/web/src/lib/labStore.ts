export type LabPreset = {
  id: string;
  name: string;
  models: string[];
  subject?: string;
  createdAt: string;
};

export type LabExperiment = {
  id: string;
  question: string;
  models: string[];
  createdAt: string;
  bestModel?: string;
  notes?: Record<string, string>;
  votes?: Record<string, number>;
};

const PRESETS_KEY = "nexus_lab_presets_v1";
const EXPERIMENTS_KEY = "nexus_lab_experiments_v1";

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
  return Array.isArray(presets) ? presets : [];
}

export function saveLabPresets(presets: LabPreset[]) {
  writeJson(PRESETS_KEY, presets);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lab-presets-updated"));
  }
}

export function upsertLabPreset(preset: LabPreset) {
  const presets = loadLabPresets();
  const filtered = presets.filter((item) => item.id !== preset.id);
  const next = [preset, ...filtered].slice(0, 50);
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
  return Array.isArray(experiments) ? experiments : [];
}

export function saveLabExperiments(experiments: LabExperiment[]) {
  writeJson(EXPERIMENTS_KEY, experiments);
}

export function upsertLabExperiment(experiment: LabExperiment) {
  const experiments = loadLabExperiments();
  const filtered = experiments.filter((item) => item.id !== experiment.id);
  const next = [experiment, ...filtered].slice(0, 200);
  saveLabExperiments(next);
  return next;
}

