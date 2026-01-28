import { gatewayModelIds } from "@/lib/modelGatewayRegistry";

export type ModelCapability = {
  speed: string;
  accuracy: string;
  costEfficiency: string;
};

export type ModelCard = {
  id: string;
  name: string;
  type: "Router" | "Model";
  provider: string;
  status: string;
  focus: string;
  routing: string;
  strengths: string[];
  useCases: string[];
  availability: string;
  latency: string;
  reliability: string;
} & ModelCapability;

export type ProviderGroup = {
  label: string;
  status: string;
  models: Array<{
    id: string;
    name: string;
  } & ModelCapability>;
};

export const routerModels: ModelCard[] = [
  {
    id: "Nexus-Core",
    name: "Nexus-Core",
    type: "Router",
    provider: "Nexus",
    status: "Active",
    focus: "General routing",
    routing: "Picks the best general model per question.",
    strengths: ["Mixed subjects", "Balanced speed/quality"],
    useCases: ["Homework help", "General Q&A"],
    availability: "99.9%",
    latency: "1.6s",
    reliability: "99.6%",
    speed: "Fast",
    accuracy: "High",
    costEfficiency: "High",
  },
  {
    id: "Nexus-Math",
    name: "Nexus-Math",
    type: "Router",
    provider: "Nexus",
    status: "Active",
    focus: "Math + physics routing",
    routing: "Routes to the best quantitative reasoning model.",
    strengths: ["Calculus", "Physics", "Stats"],
    useCases: ["Problem solving", "Quant reasoning"],
    availability: "99.8%",
    latency: "1.9s",
    reliability: "99.4%",
    speed: "Fast",
    accuracy: "High",
    costEfficiency: "Medium",
  },
  {
    id: "Nexus-Code",
    name: "Nexus-Code",
    type: "Router",
    provider: "Nexus",
    status: "Active",
    focus: "Coding + debugging routing",
    routing: "Routes to the best code model for the task.",
    strengths: ["CS", "Debugging", "Algorithms"],
    useCases: ["Code review", "Bug fixing"],
    availability: "99.7%",
    latency: "2.2s",
    reliability: "99.2%",
    speed: "Fast",
    accuracy: "High",
    costEfficiency: "Medium",
  },
  {
    id: "Nexus-Write",
    name: "Nexus-Write",
    type: "Router",
    provider: "Nexus",
    status: "Active",
    focus: "Writing + humanities routing",
    routing: "Routes to the best writing model for clarity and tone.",
    strengths: ["Essay", "History", "Literature"],
    useCases: ["Drafting", "Tone edits"],
    availability: "99.8%",
    latency: "2.4s",
    reliability: "99.3%",
    speed: "Medium",
    accuracy: "High",
    costEfficiency: "High",
  },
];

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  zai: "Z.ai",
  minimax: "MiniMax",
  mistral: "Mistral",
  amazon: "Amazon",
  alibaba: "Alibaba",
  xiaomi: "Xiaomi",
  moonshotai: "MoonshotAI",
  meta: "Meta",
  perplexity: "Perplexity",
  morph: "Morph",
  meituan: "Meituan",
  nvidia: "NVIDIA",
  bytedance: "ByteDance",
  cohere: "Cohere",
  vercel: "Vercel",
  "prime-intellect": "Prime Intellect",
  stealth: "Stealth",
  "arcee-ai": "Arcee AI",
  inception: "Inception",
  voyage: "Voyage",
  bfl: "BFL",
  recraft: "Recraft",
  kwaipilot: "KwaiPilot",
};

const providerDefaults: Record<string, ModelCapability> = {
  openai: { speed: "Fast", accuracy: "High", costEfficiency: "Medium" },
  anthropic: { speed: "Medium", accuracy: "High", costEfficiency: "Medium" },
  google: { speed: "Fast", accuracy: "High", costEfficiency: "High" },
  xai: { speed: "Fast", accuracy: "High", costEfficiency: "Medium" },
};

function humanizeModelKey(modelKey: string) {
  const spaced = modelKey.replace(/[-_]/g, " ");
  const tokens = spaced.split(" ").filter(Boolean);
  const mapped = tokens.map((token) => {
    const lower = token.toLowerCase();
    if (lower.startsWith("gpt")) return token.toUpperCase();
    if (lower.startsWith("claude")) return `Claude${token.slice(6)}`;
    if (lower.startsWith("gemini")) return `Gemini${token.slice(6)}`;
    if (lower.startsWith("llama")) return `Llama${token.slice(5)}`;
    if (lower.startsWith("qwen")) return `Qwen${token.slice(4)}`;
    if (lower.startsWith("glm")) return token.toUpperCase();
    if (lower.startsWith("grok")) return `Grok${token.slice(4)}`;
    if (lower.startsWith("kimi")) return `Kimi${token.slice(4)}`;
    if (lower.startsWith("nova")) return `Nova${token.slice(4)}`;
    if (lower.startsWith("v0")) return token;
    return token.charAt(0).toUpperCase() + token.slice(1);
  });
  return mapped.join(" ");
}

export const externalProviders: ProviderGroup[] = (() => {
  const groups = new Map<string, ProviderGroup>();
  gatewayModelIds.forEach((id) => {
    const [providerKey, modelKey] = id.split("/");
    if (!providerKey || !modelKey) return;
    const label = providerLabels[providerKey] ?? providerKey;
    const defaults = providerDefaults[providerKey] ?? {
      speed: "Medium",
      accuracy: "Medium",
      costEfficiency: "Medium",
    };
    const existing = groups.get(providerKey) ?? {
      label,
      status: "Listed",
      models: [],
    };
    existing.models.push({
      id,
      name: humanizeModelKey(modelKey),
      speed: defaults.speed,
      accuracy: defaults.accuracy,
      costEfficiency: defaults.costEfficiency,
    });
    groups.set(providerKey, existing);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    models: [...group.models].sort((a, b) => a.name.localeCompare(b.name)),
  }));
})();

export function getModelHubCards(): ModelCard[] {
  const externalCards: ModelCard[] = externalProviders.flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      name: model.name,
      type: "Model",
      provider: provider.label,
      status: provider.status,
      focus: "External provider model",
      routing: "Direct model selection.",
      strengths: [provider.label],
      useCases: ["General"],
      availability: "—",
      latency: "—",
      reliability: "—",
      speed: model.speed,
      accuracy: model.accuracy,
      costEfficiency: model.costEfficiency,
    }))
  );

  return [...routerModels, ...externalCards];
}

export function getModelGroups() {
  return [
    {
      label: "Nexus routers",
      options: routerModels.map((router) => ({
        label: `${router.name} (router)`,
        value: router.id,
      })),
    },
    ...externalProviders.map((provider) => ({
      label: provider.label,
      options: provider.models.map((model) => ({
        label: model.name,
        value: model.id,
      })),
    })),
  ];
}

export function getModelNameMap() {
  const map = new Map<string, string>();
  getModelHubCards().forEach((model) => map.set(model.id, model.name));
  return map;
}

export function getProviderIcon(provider: string) {
  switch (provider) {
    case "OpenAI":
      return "◎";
    case "Anthropic":
      return "◇";
    case "Google":
      return "◈";
    case "xAI":
      return "▲";
    case "Nexus":
      return "◆";
    default:
      return "●";
  }
}

export function getCapabilitiesLabel(model: ModelCard) {
  return `${model.speed} • ${model.accuracy} accuracy • ${model.costEfficiency} cost`;
}
