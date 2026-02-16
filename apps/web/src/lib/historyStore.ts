export type SubjectOutput = {
  subject: string;
  confidence?: number;
};

export type RouteOutput = {
  model: string;
  rationale: string;
  mode?: string;
  confidence?: number;
};

export type SolveOutput = {
  steps: string[];
  final: string;
  model?: string;
  confidence?: number;
  citations?: string[];
  durationMs?: number;
  gatewayNote?: string;
  selectionReason?: string;
  kind?: "solve" | "aggregate";
};

export type TranscriptMessage = {
  role: "user" | "assistant";
  content?: string;
  snapshotId?: string;
  tools?: {
    detectSubject?: SubjectOutput;
    routeModels?: RouteOutput[];
    solveQuestions?: SolveOutput[];
  };
};

export type ModelSelectionSnapshot = {
  id: string;
  type: "model_selection_snapshot";
  createdAt: string;
  status: "final" | "draft";
  selectionMode: "auto" | "single" | "multi";
  selectedModelIds: string[];
  aggregatorModelId?: string;
  label?: string;
  pinned: true;
  appliesTo: "answered_message_id" | "next_message";
  appliesToMessageId?: string;
};

export type TranscriptItem = TranscriptMessage | ModelSelectionSnapshot;

export type HistoryEntry = {
  id: string;
  question: string;
  subject: string;
  model: string;
  models: string[];
  transcript: TranscriptItem[];
  mode: "fast" | "deep";
  createdAt: string;
};

export const STORAGE_KEY = "nexus_history_v1";
export const MAX_HISTORY_ENTRIES = 200;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeTranscriptItem(raw: any): TranscriptItem | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "model_selection_snapshot") {
    if (typeof raw.id !== "string") return null;
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
    const selectionMode =
      raw.selectionMode === "single" || raw.selectionMode === "multi" ? raw.selectionMode : "auto";
    const selectedModelIds: string[] = Array.isArray(raw.selectedModelIds)
      ? Array.from(
          new Set(
            raw.selectedModelIds
              .filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
              .map((item: string) => item.trim())
          )
        )
      : [];
    const status = raw.status === "draft" ? "draft" : "final";
    const appliesTo =
      raw.appliesTo === "next_message" || raw.appliesTo === "answered_message_id"
        ? raw.appliesTo
        : status === "draft"
          ? "next_message"
          : "answered_message_id";
    return {
      id: raw.id,
      type: "model_selection_snapshot",
      createdAt,
      status,
      selectionMode,
      selectedModelIds,
      aggregatorModelId: typeof raw.aggregatorModelId === "string" ? raw.aggregatorModelId : undefined,
      label: typeof raw.label === "string" ? raw.label : undefined,
      pinned: true,
      appliesTo,
      appliesToMessageId:
        typeof raw.appliesToMessageId === "string" ? raw.appliesToMessageId : undefined,
    };
  }

  if (raw.role === "user" || raw.role === "assistant") {
    return {
      role: raw.role,
      content: typeof raw.content === "string" ? raw.content : "",
      snapshotId: typeof raw.snapshotId === "string" ? raw.snapshotId : undefined,
      tools: raw.tools,
    };
  }

  return null;
}

function isWithinLast30Days(entry: HistoryEntry) {
  const createdAt = new Date(entry.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= THIRTY_DAYS_MS;
}

function normalizeEntry(raw: any): HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || typeof raw.question !== "string") return null;
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const subject = typeof raw.subject === "string" ? raw.subject : "General";
  const model = typeof raw.model === "string" ? raw.model : "Nexus-Core";
  const mode = raw.mode === "deep" ? "deep" : "fast";

  const rawModels = Array.isArray(raw.models)
    ? raw.models.filter((item: any) => typeof item === "string")
    : [];
  const normalizedModels = Array.from(new Set(rawModels));

  if (Array.isArray(raw.transcript)) {
    const normalizedTranscript = raw.transcript
      .map((item: any) => normalizeTranscriptItem(item))
      .filter((item: any): item is TranscriptItem => Boolean(item));
    return {
      id: raw.id,
      question: raw.question,
      subject,
      model,
      models: normalizedModels.length ? normalizedModels : [model],
      transcript: normalizedTranscript,
      mode,
      createdAt,
    };
  }

  const legacySteps = Array.isArray(raw.steps) ? raw.steps : [];
  const legacyFinal = typeof raw.finalAnswer === "string" ? raw.finalAnswer : "";

  const transcript: TranscriptItem[] = [
    {
      role: "user",
      content: raw.question,
    },
    {
      role: "assistant",
      content: legacyFinal,
      tools: legacySteps.length
        ? {
            solveQuestions: [
              {
                steps: legacySteps,
                final: legacyFinal,
                confidence: undefined,
                citations: [],
                model,
              },
            ],
          }
        : undefined,
    },
  ];

  return {
    id: raw.id,
    question: raw.question,
    subject,
    model,
    models: normalizedModels.length ? normalizedModels : [model],
    transcript,
    mode,
    createdAt,
  };
}

function sortHistoryEntries(entries: HistoryEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function pickMostCompleteEntry(a: HistoryEntry, b: HistoryEntry) {
  if (a.transcript.length !== b.transcript.length) {
    return b.transcript.length > a.transcript.length ? b : a;
  }
  const aCreatedAt = new Date(a.createdAt).getTime();
  const bCreatedAt = new Date(b.createdAt).getTime();
  if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt)) {
    return bCreatedAt >= aCreatedAt ? b : a;
  }
  return b;
}

export function normalizeHistoryEntries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is HistoryEntry => Boolean(entry))
    .filter(isWithinLast30Days);
  return sortHistoryEntries(normalized).slice(0, MAX_HISTORY_ENTRIES);
}

export function mergeHistoryEntries(
  ...entryGroups: Array<HistoryEntry[] | undefined>
) {
  const byId = new Map<string, HistoryEntry>();
  entryGroups.forEach((entries) => {
    entries?.forEach((entry) => {
      const normalized = normalizeEntry(entry);
      if (!normalized || !isWithinLast30Days(normalized)) return;
      const existing = byId.get(normalized.id);
      if (!existing) {
        byId.set(normalized.id, normalized);
        return;
      }
      byId.set(normalized.id, pickMostCompleteEntry(existing, normalized));
    });
  });
  return sortHistoryEntries(Array.from(byId.values())).slice(
    0,
    MAX_HISTORY_ENTRIES
  );
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeHistoryEntries(parsed);
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  const normalized = mergeHistoryEntries(entries);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function addHistoryEntry(entry: HistoryEntry) {
  const entries = loadHistory();
  const nextEntries = mergeHistoryEntries([entry], entries);
  saveHistory(nextEntries);
  return nextEntries;
}

export function upsertHistoryEntry(
  entry: HistoryEntry,
  options: { moveToTop?: boolean } = {}
) {
  const { moveToTop = true } = options;
  const entries = loadHistory();
  const existingIndex = entries.findIndex((item) => item.id === entry.id);

  let nextEntries: HistoryEntry[];
  if (existingIndex === -1 || moveToTop) {
    const filtered = entries.filter((item) => item.id !== entry.id);
    nextEntries = [entry, ...filtered];
  } else {
    nextEntries = [...entries];
    nextEntries.splice(existingIndex, 1, entry);
  }

  const trimmedEntries = nextEntries.slice(0, MAX_HISTORY_ENTRIES);
  saveHistory(trimmedEntries);
  return trimmedEntries;
}

export function getHistoryEntry(id: string): HistoryEntry | null {
  const entries = loadHistory();
  return entries.find((entry) => entry.id === id) ?? null;
}
