const BLOCKED_MODEL_IDS = new Set([
  "deepseek/deepseek-r1-distill-llama-70b",
  "deepseek/deepseek-r1-distill-llama-70b:free",
]);

const BLOCKED_MODEL_ID_PATTERNS = [
  /deepseek\/deepseek-r1-distill-llama-70b/i,
  /deepseek-r1-distill-llama-70b/i,
];

function normalizeModelId(modelId: string) {
  return modelId.trim().toLowerCase();
}

export function isBlockedModelId(modelId: string) {
  const normalized = normalizeModelId(modelId);
  if (!normalized) return false;
  if (BLOCKED_MODEL_IDS.has(normalized)) return true;
  return BLOCKED_MODEL_ID_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function filterBlockedModelIds(modelIds: readonly string[]) {
  return modelIds.filter((modelId) => !isBlockedModelId(modelId));
}
