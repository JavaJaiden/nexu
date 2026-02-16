import type { Message } from "ai";
import type { PdfAttachment } from "@/lib/externalContext";
import type {
  ModelSelectionSnapshot,
  RouteOutput,
  SolveOutput,
  SubjectOutput,
  TranscriptItem,
} from "@/lib/historyStore";
import type { ModelCard } from "@/lib/modelCatalog";

export type {
  SubjectOutput,
  RouteOutput,
  SolveOutput,
  ModelSelectionSnapshot,
  TranscriptItem,
};
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

export type ChatAttachment = {
  name: string;
  type: string;
  data: string;
};

export type ComposerMode = "fast" | "deep" | "none";

export type BranchSeedPayload = {
  question: string;
  answer: string;
  answerModel?: string;
  tools?: ToolOverrides;
};

export type ExecutionPlan = {
  runId: string;
  question: string;
  modelIds: string[];
  aggregatorId?: string;
  snapshotId?: string;
  createdAt: number;
  mode: "fast" | "deep";
  temperature?: number;
  maxTokens?: number;
  contextMessages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  attachments: ChatAttachment[];
};

export type MultiModelRun = {
  id: string;
  runId: string;
  queryText: string;
  status: "running" | "complete" | "error" | "cancelled";
  progressPhase?: "models" | "aggregating" | "complete" | "error" | "cancelled";
  progressPercent?: number;
  isRetrying?: boolean;
  aggregationStartedAt?: number;
  selectedModels: string[];
  resultsByModel: Record<string, ModelResult>;
  aggregated?: AggregatedResult;
  executionPlan: ExecutionPlan;
  snapshotId?: string;
  timings: { startAt: number; endAt?: number };
  counts: {
    total: number;
    complete: number;
    failed: number;
    cancelled: number;
  };
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
  createdAt?: string | Date;
  attachments?: ChatAttachment[];
  tools?: ToolOverrides;
};

export type SaveTranscriptPayload = {
  transcript: TranscriptItem[];
  models: string[];
  mode: "fast" | "deep";
  hasRun: boolean;
};

export type SuggestionTask = "code" | "creative" | "analysis" | "general";

export type TaskSuggestionModel = {
  id: string;
  name: string;
};

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isBusy: boolean;
  isReadOnly?: boolean;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  showSteps: boolean;
  onToggleSteps: () => void;
  showCitations: boolean;
  onToggleCitations: () => void;
  attachments: PdfAttachment[];
  onRemoveAttachment: (index: number) => void;
  onFilesSelected: (files: FileList | null) => void;
  taskSuggestions: Record<SuggestionTask, TaskSuggestionModel[]>;
  onUseSuggestedAggregator: (modelId: string) => void;
  onAddSuggestedModelsToStack: (modelIds: string[]) => void;
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
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
  onCopyAggregated: () => void;
  onRetryModel: (modelId: string) => void;
  onRetryAll: () => void;
  onBranchModel: (modelId: string) => void;
  onBranchAggregated: () => void;
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
  onCopyAggregated: (runId: string) => void;
  onRetryModel: (runId: string, modelId: string) => void;
  onRetryAll: (runId: string) => void;
  onBranchModel: (runId: string, modelId: string) => void;
  onBranchAggregated: (runId: string) => void;
}
