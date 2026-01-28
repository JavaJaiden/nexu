export type ModelResult = {
  modelId: string;
  status: "running" | "complete" | "error" | "cancelled";
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  text?: string;
  errorMessage?: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  messages: ConversationMessage[];
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
