import type { Message } from "ai";
import type { ModelCard } from "@/lib/modelCatalog";
import type {
  SubjectOutput,
  RouteOutput,
  SolveOutput,
  ModelSelectionSnapshot,
  TranscriptItem,
} from "@/lib/historyStore";
import type { PdfAttachment } from "@/lib/externalContext";

export type { SubjectOutput, RouteOutput, SolveOutput, ModelSelectionSnapshot, TranscriptItem };
export type { PdfAttachment };
export type { ModelCard };

export type ModelResult = {
  modelId: string;
  status: "running" | "complete" | "error" | "cancelled";
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  text?: string;
  steps?: string[];
  confidence?: number;
  citations?: string[];
  selectionReason?: string;
  gatewayNote?: string;
  usedModel?: string;
  errorMessage?: string;
};

export type AggregatedResult = {
  text: string;
  attribution?: { modelIdsUsed: string[] };
  confidence?: number;
};

export type ExecutionPlan = {
  runId: string;
  question: string;
  modelIds: string[];
  aggregatorId?: string;
  snapshotId?: string;
  createdAt: number;
  mode: "fast" | "deep";
  attachments: Array<{ name: string; type: string; data: string }>;
};

export type MultiModelRun = {
  id: string;
  runId: string;
  queryText: string;
  status: "running" | "complete" | "error" | "cancelled";
  selectedModels: string[];
  resultsByModel: Record<string, ModelResult>;
  aggregated?: AggregatedResult;
  executionPlan: ExecutionPlan;
  snapshotId?: string;
  timings: { startAt: number; endAt?: number };
  counts: { total: number; complete: number; failed: number; cancelled: number };
  showIndividual: boolean;
  collapsed: boolean;
};

export type ChatEntry =
  | { kind: "message"; message: Message }
  | { kind: "run"; runId: string }
  | { kind: "snapshot"; snapshot: ModelSelectionSnapshot };

export type ToolOverrides = {
  detectSubject?: SubjectOutput;
  routeModels?: RouteOutput[];
  solveQuestions?: SolveOutput[];
};

export type ChatMessage = Message & {
  snapshotId?: string;
  optimistic?: boolean;
  clientMessageId?: string;
  runId?: string;
  createdAt?: string;
};

export type SaveTranscriptPayload = {
  transcript: TranscriptItem[];
  models: string[];
  mode: "fast" | "deep";
  hasRun: boolean;
};

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isBusy: boolean;
  isReadOnly?: boolean;
  attachments: PdfAttachment[];
  onRemoveAttachment: (index: number) => void;
  onFilesSelected: (files: FileList | null) => void;
  placeholder?: string;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  isUser: boolean;
  toolOverride?: ToolOverrides;
  showSteps: boolean;
  showCitations: boolean;
  globalCollapsed: boolean;
  modelMetaMap: Map<string, ModelCard>;
  modelNameMap: Map<string, string>;
}

export interface RunPanelProps {
  run: MultiModelRun;
  modelNameMap: Map<string, string>;
  showSteps: boolean;
  showCitations: boolean;
  onCompare: () => void;
  onToggleIndividual: () => void;
  onCopy: (modelId: string) => void;
}

export interface TimelineProps {
  entries: ChatEntry[];
  runs: MultiModelRun[];
  toolOverrides?: Record<string, ToolOverrides>;
  toolOverridesByIndex?: Array<ToolOverrides | undefined>;
  showSteps: boolean;
  showCitations: boolean;
  collapseAll: boolean;
  modelMetaMap: Map<string, ModelCard>;
  modelNameMap: Map<string, string>;
  onCompareRun: (runId: string) => void;
  onToggleRunIndividual: (runId: string) => void;
  onCopyModel: (runId: string, modelId: string) => void;
}
