import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { missingEnvVariableUrl } from "./utils";

const OPENROUTER_KEY = "openrouter" as const;

const ALLOWED_CAPABILITIES = new Set([
  "chat",
  "completion",
  "vision",
  "tools",
  "function-calling",
  "streaming",
  "image-generation",
  "image-understanding",
]);

const leaderboardModelValidator = v.object({
  id: v.string(),
  source: v.literal("openrouter"),
  modelId: v.string(),
  name: v.string(),
  provider: v.string(),
  description: v.optional(v.string()),
  contextLength: v.optional(v.number()),
  pricing: v.optional(
    v.object({
      prompt: v.optional(v.number()),
      completion: v.optional(v.number()),
    })
  ),
  capabilities: v.array(v.string()),
  availability: v.optional(v.union(v.literal("available"), v.literal("unknown"))),
  updatedAt: v.number(),
});

type OpenRouterModelRecord = {
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  description?: unknown;
  context_length?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
    [key: string]: unknown;
  };
  modalities?: unknown;
  supported_parameters?: unknown;
  availability?: unknown;
  status?: unknown;
  enabled?: unknown;
  is_available?: unknown;
  top_provider?: {
    provider?: unknown;
    context_length?: unknown;
    [key: string]: unknown;
  };
  architecture?: {
    modality?: unknown;
    input_modalities?: unknown;
    output_modalities?: unknown;
    supports_tools?: unknown;
    supports_function_calling?: unknown;
    supports_streaming?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toTokenList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toTokenList(item));
  }

  return [];
}

function uniqueSorted(values: Iterable<string>) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toPerMillion(value: unknown): number | undefined {
  const parsed = numberFromUnknown(value);
  if (parsed === undefined || parsed < 0) return undefined;
  if (parsed === 0) return 0;
  // OpenRouter often reports token-level pricing; convert conservatively.
  const normalized = parsed < 0.01 ? parsed * 1_000_000 : parsed;
  return Number(normalized.toFixed(6));
}

function humanizeModelKey(modelId: string) {
  const key = modelId.split("/")[1] ?? modelId;
  return key
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveCapabilities(record: OpenRouterModelRecord): string[] {
  const capabilities = new Set<string>();

  const modality = asString(record.architecture?.modality);
  const [rawInput, rawOutput = ""] = modality
    ? modality.toLowerCase().split("->").map((part) => part.trim())
    : ["", ""];

  const inputTokens = new Set([
    ...toTokenList(rawInput),
    ...toTokenList(record.architecture?.input_modalities),
  ]);
  const outputTokens = new Set([
    ...toTokenList(rawOutput),
    ...toTokenList(record.architecture?.output_modalities),
  ]);
  const modalityTokens = new Set([
    ...toTokenList(modality),
    ...toTokenList(record.modalities),
    ...inputTokens,
    ...outputTokens,
  ]);
  const supportedTokens = new Set(toTokenList(record.supported_parameters));

  const hasTextOutput = outputTokens.has("text");
  const hasTextModality = modalityTokens.has("text");
  if (hasTextOutput || hasTextModality) {
    capabilities.add("completion");
    capabilities.add("chat");
  }

  const hasImageInput = inputTokens.has("image") || inputTokens.has("vision");
  const hasImageOutput = outputTokens.has("image");
  const hasVision =
    hasImageInput ||
    hasImageOutput ||
    modalityTokens.has("image") ||
    modalityTokens.has("vision");

  if (hasVision) capabilities.add("vision");
  if (hasImageInput) capabilities.add("image-understanding");
  if (hasImageOutput) capabilities.add("image-generation");

  if (
    supportedTokens.has("tools") ||
    supportedTokens.has("tool") ||
    supportedTokens.has("tool_choice") ||
    record.architecture?.supports_tools === true
  ) {
    capabilities.add("tools");
  }

  if (
    supportedTokens.has("function") ||
    supportedTokens.has("functions") ||
    supportedTokens.has("function_calling") ||
    supportedTokens.has("function-calling") ||
    record.architecture?.supports_function_calling === true
  ) {
    capabilities.add("function-calling");
  }

  if (
    supportedTokens.has("stream") ||
    supportedTokens.has("streaming") ||
    record.architecture?.supports_streaming === true
  ) {
    capabilities.add("streaming");
  }

  return uniqueSorted(
    Array.from(capabilities).filter((capability) =>
      ALLOWED_CAPABILITIES.has(capability)
    )
  );
}

function deriveAvailability(
  record: OpenRouterModelRecord
): "available" | "unknown" | undefined {
  if (record.enabled === true || record.is_available === true) {
    return "available";
  }
  if (record.enabled === false || record.is_available === false) {
    return "unknown";
  }

  const status = asString(record.status ?? record.availability)?.toLowerCase();
  if (!status) return undefined;
  if (
    status.includes("available") ||
    status.includes("active") ||
    status.includes("enabled")
  ) {
    return "available";
  }
  if (
    status.includes("unavailable") ||
    status.includes("disabled") ||
    status.includes("deprecated") ||
    status.includes("offline")
  ) {
    return "unknown";
  }

  return undefined;
}

function normalizeModel(
  record: OpenRouterModelRecord,
  updatedAt: number
): {
  id: string;
  source: "openrouter";
  modelId: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt?: number; completion?: number };
  capabilities: string[];
  availability?: "available" | "unknown";
  updatedAt: number;
} | null {
  const modelId = asString(record.id);
  if (!modelId) return null;

  const providerFromId = modelId.split("/")[0]?.trim();
  const provider =
    providerFromId ||
    asString(record.provider) ||
    asString(record.top_provider?.provider) ||
    "unknown";

  const name = asString(record.name) ?? humanizeModelKey(modelId);
  const description = asString(record.description);
  const contextLength = numberFromUnknown(
    record.context_length ?? record.top_provider?.context_length
  );
  const prompt = toPerMillion(record.pricing?.prompt);
  const completion = toPerMillion(record.pricing?.completion);
  const pricing =
    prompt === undefined && completion === undefined
      ? undefined
      : { prompt, completion };

  return {
    id: `openrouter:${modelId}`,
    source: "openrouter",
    modelId,
    name,
    provider,
    description,
    contextLength,
    pricing,
    capabilities: deriveCapabilities(record),
    availability: deriveAvailability(record),
    updatedAt,
  };
}

function parseCsvSet(value: string | undefined) {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminIdentity(
  identity: {
    subject?: string | null;
    tokenIdentifier?: string | null;
    [key: string]: unknown;
  } | null
) {
  const allowedUserIds = parseCsvSet(process.env.LEADERBOARD_ADMIN_USER_IDS);
  const allowedEmails = parseCsvSet(process.env.LEADERBOARD_ADMIN_EMAILS);

  if (allowedUserIds.size === 0 && allowedEmails.size === 0) {
    return false;
  }

  const subject = (identity?.subject ?? "").trim().toLowerCase();
  if (subject && allowedUserIds.has(subject)) return true;

  const rawIdentity = (identity ?? {}) as {
    email?: unknown;
    tokenIdentifier?: unknown;
  };

  const emailCandidates = new Set<string>();
  const email = asString(rawIdentity.email);
  if (email) emailCandidates.add(email.toLowerCase());

  const tokenIdentifier = asString(rawIdentity.tokenIdentifier);
  if (tokenIdentifier) {
    if (tokenIdentifier.includes("@")) {
      emailCandidates.add(tokenIdentifier.toLowerCase());
    }
    const suffix = tokenIdentifier.split("|").at(-1);
    if (suffix && suffix.includes("@")) {
      emailCandidates.add(suffix.toLowerCase());
    }
  }

  return Array.from(emailCandidates).some((value) => allowedEmails.has(value));
}

export const upsertOpenRouterModels = internalMutation({
  args: {
    models: v.array(leaderboardModelValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("leaderboardModels").collect();
    const existingByModelId = new Map(existing.map((model) => [model.modelId, model]));
    const incomingModelIds = new Set(args.models.map((model) => model.modelId));

    for (const model of existing) {
      if (model.source === OPENROUTER_KEY && !incomingModelIds.has(model.modelId)) {
        await ctx.db.delete(model._id);
      }
    }

    for (const model of args.models) {
      const existingModel = existingByModelId.get(model.modelId);
      if (existingModel) {
        await ctx.db.patch(existingModel._id, model);
        continue;
      }
      await ctx.db.insert("leaderboardModels", model);
    }
  },
});

export const setIngestStateSuccess = internalMutation({
  args: {
    lastRunAt: v.number(),
    lastSuccessAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leaderboardIngestState")
      .withIndex("by_key", (q) => q.eq("key", OPENROUTER_KEY))
      .first();
    const patch = {
      key: OPENROUTER_KEY,
      lastRunAt: args.lastRunAt,
      lastSuccessAt: args.lastSuccessAt,
      lastError: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }
    await ctx.db.insert("leaderboardIngestState", patch);
  },
});

export const setIngestStateFailure = internalMutation({
  args: {
    lastRunAt: v.number(),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leaderboardIngestState")
      .withIndex("by_key", (q) => q.eq("key", OPENROUTER_KEY))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastRunAt: args.lastRunAt,
        lastError: args.lastError,
      });
      return;
    }
    await ctx.db.insert("leaderboardIngestState", {
      key: OPENROUTER_KEY,
      lastRunAt: args.lastRunAt,
      lastError: args.lastError,
    });
  },
});

export const ingestOpenRouterModels = internalAction({
  args: {
    trigger: v.optional(v.string()),
    initiatedBy: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const runAt = Date.now();
    const apiKey = process.env.OR_API_KEY;
    const baseUrl = process.env.OR_BASE_URL;

    if (!apiKey || !baseUrl) {
      const messages = [
        !apiKey
          ? missingEnvVariableUrl("OR_API_KEY", "https://openrouter.ai/keys")
          : null,
        !baseUrl
          ? missingEnvVariableUrl(
              "OR_BASE_URL",
              "https://openrouter.ai/docs#requests"
            )
          : null,
      ].filter((message): message is string => Boolean(message));

      const errorMessage = messages.join("\n");
      await ctx.runMutation(internal.leaderboardModels.setIngestStateFailure, {
        lastRunAt: runAt,
        lastError: errorMessage,
      });
      throw new Error(errorMessage);
    }

    try {
      const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter /models failed: ${response.status} ${response.statusText}`
        );
      }

      const payload = (await response.json()) as { data?: OpenRouterModelRecord[] };
      const records = Array.isArray(payload.data) ? payload.data : [];

      const models = records
        .map((record) => normalizeModel(record, runAt))
        .filter(
          (
            model
          ): model is {
            id: string;
            source: "openrouter";
            modelId: string;
            name: string;
            provider: string;
            description?: string;
            contextLength?: number;
            pricing?: { prompt?: number; completion?: number };
            capabilities: string[];
            availability?: "available" | "unknown";
            updatedAt: number;
          } => Boolean(model)
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      await ctx.runMutation(internal.leaderboardModels.upsertOpenRouterModels, {
        models,
      });
      await ctx.runMutation(internal.leaderboardModels.setIngestStateSuccess, {
        lastRunAt: runAt,
        lastSuccessAt: Date.now(),
      });

      return {
        ok: true,
        count: models.length,
        source: OPENROUTER_KEY,
        runAt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ingest error";
      await ctx.runMutation(internal.leaderboardModels.setIngestStateFailure, {
        lastRunAt: runAt,
        lastError: message,
      });
      throw new Error(message);
    }
  },
});

export const leaderboardIngestNow = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ ok: true; count: number; source: "openrouter"; runAt: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: sign in to run leaderboard ingest.");
    }
    if (!isAdminIdentity(identity)) {
      throw new Error("Forbidden: you are not allowed to run leaderboard ingest.");
    }

    const result = (await ctx.runAction(
      internal.leaderboardModels.ingestOpenRouterModels as any,
      {
        trigger: "manual",
        initiatedBy: identity.subject,
      }
    )) as {
      ok: true;
      count: number;
      source: "openrouter";
      runAt: number;
    };

    return result;
  },
});

export const list = query({
  args: {
    provider: v.optional(v.string()),
    capability: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    sort: v.optional(
      v.union(v.literal("name"), v.literal("provider"), v.literal("price"))
    ),
    sortDir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    let models = await ctx.db.query("leaderboardModels").collect();

    const provider = asString(args.provider)?.toLowerCase();
    const capability = asString(args.capability)?.toLowerCase();
    const search = asString(args.search)?.toLowerCase();
    const sort = args.sort ?? "name";
    const sortDir = args.sortDir ?? "asc";
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 100), 1), 500);

    if (provider) {
      models = models.filter((model) => model.provider.toLowerCase() === provider);
    }

    if (capability) {
      models = models.filter((model) =>
        model.capabilities.some((entry) => entry.toLowerCase() === capability)
      );
    }

    if (search) {
      models = models.filter((model) => {
        const haystack = `${model.name} ${model.provider} ${model.modelId}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const compareNumbers = (a?: number, b?: number) => {
      if (a === undefined && b === undefined) return 0;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return a - b;
    };

    models.sort((left, right) => {
      let comparison = 0;
      if (sort === "provider") {
        comparison = left.provider.localeCompare(right.provider);
      } else if (sort === "price") {
        const leftPrice = left.pricing?.prompt ?? left.pricing?.completion;
        const rightPrice = right.pricing?.prompt ?? right.pricing?.completion;
        comparison = compareNumbers(leftPrice, rightPrice);
      } else {
        comparison = left.name.localeCompare(right.name);
      }
      return sortDir === "desc" ? -comparison : comparison;
    });

    return models.slice(0, limit).map((model) => ({
      id: model.id,
      source: model.source,
      modelId: model.modelId,
      name: model.name,
      provider: model.provider,
      description: model.description,
      contextLength: model.contextLength,
      pricing: model.pricing,
      capabilities: model.capabilities,
      availability: model.availability ?? "unknown",
      updatedAt: model.updatedAt,
    }));
  },
});

export const filters = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("leaderboardModels").collect();
    const providers = uniqueSorted(models.map((model) => model.provider));
    const capabilities = uniqueSorted(models.flatMap((model) => model.capabilities));

    return {
      providers,
      capabilities,
      count: models.length,
    };
  },
});

export const ingestState = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("leaderboardIngestState")
      .withIndex("by_key", (q) => q.eq("key", OPENROUTER_KEY))
      .first();
  },
});
