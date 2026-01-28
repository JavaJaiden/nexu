import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { gatewayModelIds } from "@/lib/modelGatewayRegistry";

type GatewayModelSpec = {
  label: string;
  provider: string;
  modelId: string;
  available: boolean;
};

const baseOpenAIModels: GatewayModelSpec[] = [
  { label: "gpt-4o-mini", provider: "openai", modelId: "gpt-4o-mini", available: true },
  { label: "gpt-4o", provider: "openai", modelId: "gpt-4o", available: true },
  { label: "gpt-4.1", provider: "openai", modelId: "gpt-4.1", available: true },
  { label: "gpt-4.1-mini", provider: "openai", modelId: "gpt-4.1-mini", available: true },
  { label: "o1", provider: "openai", modelId: "o1", available: true },
  { label: "o3-mini", provider: "openai", modelId: "o3-mini", available: true },
];

const openaiAllowlist = new Set(
  baseOpenAIModels.map((model) => model.modelId).concat([
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-instruct",
    "gpt-4-turbo",
    "o3",
    "o3-mini",
    "o3-pro",
    "o4-mini",
  ])
);

const registryModels: GatewayModelSpec[] = gatewayModelIds.map((id) => {
  const [provider, modelKey] = id.split("/");
  const isOpenAI = provider === "openai";
  const normalizedModelId = isOpenAI ? modelKey : modelKey;
  return {
    label: id,
    provider,
    modelId: normalizedModelId,
    available: isOpenAI && openaiAllowlist.has(normalizedModelId),
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

function pickCandidate(candidates: string[], usageCounts: UsageCounts, maxSame: number) {
  const sorted = [...candidates].sort(
    (a, b) => (usageCounts[a] ?? 0) - (usageCounts[b] ?? 0)
  );
  return sorted.find((candidate) => (usageCounts[candidate] ?? 0) < maxSame) ?? sorted[0];
}

export function resolveRouterModel(
  routerLabel: string,
  usageCounts: UsageCounts,
  maxSame: number
): GatewayResolution {
  const candidates = (routerCandidates[routerLabel] ?? availableOpenAI).filter((candidate) =>
    availableOpenAI.includes(candidate)
  );
  const fallback = candidates.length > 0 ? candidates : ["gpt-4o-mini"];
  const picked = pickCandidate(fallback, usageCounts, maxSame);
  const spec = gatewayModels.find((entry) => entry.label === picked);
  if (!spec) {
    return {
      model: openai("gpt-4o-mini"),
      resolvedLabel: "gpt-4o-mini",
      requestedLabel: routerLabel,
      fallbackNote: "Fallback to gpt-4o-mini.",
    };
  }
  return {
    model: openai(spec.modelId),
    resolvedLabel: spec.label,
    requestedLabel: routerLabel,
  };
}

export function resolveGatewayModel(
  preferredLabel: string | null,
  fallbackLabel: string,
  fallbackModelId: string
): GatewayResolution {
  if (!preferredLabel) {
    return {
      model: openai(fallbackModelId),
      resolvedLabel: fallbackLabel,
    };
  }

  const spec = gatewayModels.find((entry) => entry.label === preferredLabel);
  if (!spec) {
    return {
      model: openai(fallbackModelId),
      resolvedLabel: fallbackLabel,
      requestedLabel: preferredLabel,
      fallbackNote: `Requested model ${preferredLabel} is not in the gateway yet.`,
    };
  }

  if (!spec.available || spec.provider !== "openai") {
    return {
      model: openai(fallbackModelId),
      resolvedLabel: fallbackLabel,
      requestedLabel: preferredLabel,
      fallbackNote: `Requested model ${preferredLabel} is not available yet. Routed to ${fallbackLabel}.`,
    };
  }

  return {
    model: openai(spec.modelId),
    resolvedLabel: spec.label,
    requestedLabel: preferredLabel,
  };
}
