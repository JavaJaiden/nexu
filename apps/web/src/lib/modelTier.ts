import type { ModelCard } from "@/lib/modelCatalog";

const PRO_MODEL_ID_HINTS = [
  /gpt-5/i,
  /gpt-4\.1/i,
  /gpt-4o(?!-mini)/i,
  /o1\b/i,
  /o3\b/i,
  /o4\b/i,
  /claude-.*(opus|sonnet)/i,
  /gemini-.*(pro|ultra)/i,
  /deepseek-.*(r1|thinking)/i,
  /qwen-?3-?235b/i,
  /llama-4/i,
  /mistral-.*large/i,
  /grok-4/i,
  /kimi-?k2/i,
  /morph-?v3-?large/i,
];

export function categorizeModelTier(model: ModelCard): "quick" | "pro" {
  if (model.type === "Router") return "quick";
  const id = model.id.toLowerCase();
  if (PRO_MODEL_ID_HINTS.some((pattern) => pattern.test(id))) return "pro";
  if (model.accuracy === "High" && model.costEfficiency === "Low") return "pro";
  return "quick";
}

export function deriveCapabilityTags(model: ModelCard) {
  const id = model.id.toLowerCase();
  const tags = new Set<string>();
  tags.add("chat");
  tags.add("tools");
  tags.add("streaming");
  tags.add("function calling");
  if (model.type === "Router") {
    tags.add("routing");
    tags.add("agent");
  }
  if (id.includes("vision") || id.includes("image") || id.includes("vl")) {
    tags.add("vision");
    tags.add("image");
  }
  if (id.includes("embed")) tags.add("embedding");
  if (id.includes("code") || id.includes("coder") || id.includes("codex")) tags.add("code");
  if (id.includes("math")) tags.add("math");
  if (id.includes("search")) tags.add("search");
  if (id.includes("reason") || id.includes("thinking")) tags.add("reasoning");
  return Array.from(tags);
}
