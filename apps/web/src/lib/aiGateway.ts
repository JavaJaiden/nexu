import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { gatewayModelIds } from "@/lib/modelGatewayRegistry";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL_PREFIX = "openai/";

const openRouterHeaders: Record<string, string> = {
  "X-Title": "Nexu",
};
if (process.env.NEXT_PUBLIC_APP_URL) {
  openRouterHeaders["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
}

export function createOpenRouterProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: openRouterHeaders,
    name: "openrouter",
  });
}

export const openrouter = createOpenRouterProvider(
  process.env.OR_API_KEY ?? ""
);

type GatewayModelSpec = {
  label: string;
  provider: string;
  modelId: string;
  available: boolean;
};

function normalizeOpenRouterModelId(modelId: string) {
  return modelId.includes("/")
    ? modelId
    : `${OPENROUTER_MODEL_PREFIX}${modelId}`;
}

const baseOpenAIModels: GatewayModelSpec[] = [
  {
    label: "gpt-4o-mini",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("gpt-4o-mini"),
    available: true,
  },
  {
    label: "gpt-4o",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("gpt-4o"),
    available: true,
  },
  {
    label: "gpt-4.1",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("gpt-4.1"),
    available: true,
  },
  {
    label: "gpt-4.1-mini",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("gpt-4.1-mini"),
    available: true,
  },
  {
    label: "o1",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("o1"),
    available: true,
  },
  {
    label: "o3-mini",
    provider: "openai",
    modelId: normalizeOpenRouterModelId("o3-mini"),
    available: true,
  },
];

const registryModels: GatewayModelSpec[] = gatewayModelIds.map((id) => {
  const [provider] = id.split("/");
  const normalizedModelId = normalizeOpenRouterModelId(id);
  return {
    label: id,
    provider,
    modelId: normalizedModelId,
    available: true,
  };
});

const gatewayModels: GatewayModelSpec[] = (() => {
  const map = new Map<string, GatewayModelSpec>();
  [...baseOpenAIModels, ...registryModels].forEach((model) => {
    map.set(model.label, model);
  });
  return Array.from(map.values());
})();

export type GatewayResolution = {
  model: LanguageModel;
  resolvedLabel: string;
  requestedLabel?: string;
  fallbackNote?: string;
};

type UsageCounts = Record<string, number>;

const routerCandidates: Record<string, string[]> = {
  "Nexus-Core": ["gpt-4o", "gpt-4.1", "gpt-4o-mini"],
  "Nexus-Math": ["gpt-4.1", "o1", "gpt-4o"],
  "Nexus-Code": ["gpt-4.1-mini", "gpt-4o", "o3-mini"],
  "Nexus-Write": ["gpt-4o", "gpt-4.1-mini", "o3-mini"],
};

const availableOpenAI = gatewayModels
  .filter((entry) => entry.provider === "openai" && entry.available)
  .map((entry) => entry.label);

function pickCandidate(
  candidates: string[],
  usageCounts: UsageCounts,
  maxSame: number
) {
  const sorted = [...candidates].sort(
    (a, b) => (usageCounts[a] ?? 0) - (usageCounts[b] ?? 0)
  );
  return (
    sorted.find((candidate) => (usageCounts[candidate] ?? 0) < maxSame) ??
    sorted[0]
  );
}

export function resolveRouterModel(
  routerLabel: string,
  usageCounts: UsageCounts,
  maxSame: number,
  provider = openrouter
): GatewayResolution {
  const candidates = (routerCandidates[routerLabel] ?? availableOpenAI).filter(
    (candidate) => availableOpenAI.includes(candidate)
  );
  const fallback = candidates.length > 0 ? candidates : ["gpt-4o-mini"];
  const picked = pickCandidate(fallback, usageCounts, maxSame);
  const spec = gatewayModels.find((entry) => entry.label === picked);
  if (!spec) {
    return {
      model: provider(normalizeOpenRouterModelId("gpt-4o-mini")),
      resolvedLabel: "gpt-4o-mini",
      requestedLabel: routerLabel,
      fallbackNote: "Fallback to gpt-4o-mini.",
    };
  }
  return {
    model: provider(spec.modelId),
    resolvedLabel: spec.label,
    requestedLabel: routerLabel,
  };
}

export function resolveGatewayModel(
  preferredLabel: string | null,
  fallbackLabel: string,
  fallbackModelId: string,
  provider = openrouter
): GatewayResolution {
  const normalizedFallbackModelId = normalizeOpenRouterModelId(fallbackModelId);
  if (!preferredLabel) {
    return {
      model: provider(normalizedFallbackModelId),
      resolvedLabel: fallbackLabel,
    };
  }

  const spec = gatewayModels.find((entry) => entry.label === preferredLabel);
  if (!spec) {
    return {
      model: provider(normalizedFallbackModelId),
      resolvedLabel: fallbackLabel,
      requestedLabel: preferredLabel,
      fallbackNote: `Requested model ${preferredLabel} is not in the gateway yet.`,
    };
  }

  if (!spec.available) {
    return {
      model: provider(normalizedFallbackModelId),
      resolvedLabel: fallbackLabel,
      requestedLabel: preferredLabel,
      fallbackNote: `Requested model ${preferredLabel} is not available yet. Routed to ${fallbackLabel}.`,
    };
  }

  return {
    model: provider(spec.modelId),
    resolvedLabel: spec.label,
    requestedLabel: preferredLabel,
  };
}
