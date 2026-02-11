export type AssetScope = "private" | "org";

export type AssetType =
  | "model_preset"
  | "agent"
  | "multi_agent"
  | "pipeline"
  | "dataset"
  | "file";

export type AssetCategory =
  | "Customer Support"
  | "Data Analysis"
  | "Content Generation"
  | "Automation"
  | "Research"
  | null;

export type AssetComplexity = "Simple" | "Medium" | "Complex" | "Enterprise" | null;

export type RoutingMode = "auto" | "single" | "multi";

export type ModelPresetPayload = {
  modelIds: string[];
  aggregatorId?: string;
  routingMode: RoutingMode;
  temperature?: number;
  maxTokens?: number;
};

export type FileAssetPayload = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url?: string;
};

export type GenericAssetPayload = Record<string, unknown>;

export type AssetPayload = ModelPresetPayload | FileAssetPayload | GenericAssetPayload;

export type ProjectRecord = {
  id: string;
  scope: AssetScope;
  orgId?: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = {
  id: string;
  scope: AssetScope;
  orgId?: string;
  ownerId: string;
  projectId?: string;
  type: AssetType;
  name: string;
  description?: string;
  tags: string[];
  category?: AssetCategory;
  complexity?: AssetComplexity;
  rating?: number | null;
  useCount?: number;
  createdAt: string;
  updatedAt: string;
  payload: AssetPayload;
  isFavorite?: boolean;
};

export type FavoriteRecord = {
  id: string;
  userId: string;
  assetId: string;
  createdAt: string;
};

export const ASSET_TYPE_LABELS: Record<AssetType | "all", string> = {
  all: "All Assets",
  model_preset: "Models",
  dataset: "Datasets",
  file: "Files",
  agent: "Agents",
  multi_agent: "Multi-Agent",
  pipeline: "Pipelines",
};

export const ASSET_CATEGORIES: Exclude<AssetCategory, null>[] = [
  "Customer Support",
  "Data Analysis",
  "Content Generation",
  "Automation",
  "Research",
];

export const ASSET_COMPLEXITIES: Exclude<AssetComplexity, null>[] = [
  "Simple",
  "Medium",
  "Complex",
  "Enterprise",
];
