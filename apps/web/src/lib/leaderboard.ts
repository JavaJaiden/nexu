import fs from "node:fs/promises";
import path from "node:path";
import { getModelHubCards, type ModelCard } from "@/lib/modelCatalog";

export type LeaderboardModel = {
  id: string;
  name: string;
  provider: string;
  providerIconKey?: string;
  pricePer1M?: { input?: number; output?: number };
  capabilities: string[];
  categories: string[];
  availability?: "available" | "lite" | "unknown";
  scores?: {
    overall?: number;
    coding?: number;
    math?: number;
    reasoning?: number;
    [key: string]: number | undefined;
  };
  source: "artificialanalysis" | "openrouter" | "arena" | "internal";
  rank?: number;
};

const CACHE_PATH = path.join(process.cwd(), "cache", "leaderboard-models.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function normalizeKey(provider: string, name: string) {
  return `${provider.trim().toLowerCase()}|${name.trim().toLowerCase()}`;
}

function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === "object") {
    const nested = (value as Record<string, unknown>).score ?? (value as Record<string, unknown>).value;
    if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  }
  return undefined;
}

function pickScore(evals: Record<string, unknown> | undefined, keywords: string[]) {
  if (!evals) return undefined;
  const entries = Object.entries(evals);
  for (const [key, value] of entries) {
    const lower = key.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      const score = numberFromUnknown(value);
      if (score !== undefined) return score;
    }
  }
  return undefined;
}

function deriveCapabilitiesFromModelCard(model: ModelCard) {
  const tags = new Set<string>();
  if (model.type === "Router") tags.add("routing");
  if (model.useCases.some((useCase) => /code|debug/i.test(useCase))) tags.add("code-generation");
  if (model.useCases.some((useCase) => /problem|homework|q&a/i.test(useCase))) tags.add("chat");
  if (model.strengths.some((strength) => /code|debug/i.test(strength))) tags.add("function-calling");
  tags.add("text-generation");
  if (model.speed.toLowerCase() === "fast") tags.add("streaming");
  if (/vision|image|vl/i.test(model.id)) {
    tags.add("vision");
    tags.add("image-understanding");
  }
  return Array.from(tags);
}

function deriveCategoriesFromModelCard(model: ModelCard) {
  return Array.from(new Set([...model.strengths, ...model.useCases]));
}

function stripHtmlToLines(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function fetchArtificialAnalysisModels(): Promise<LeaderboardModel[]> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetch("https://artificialanalysis.ai/api/v1/data/llms/models", {
      headers: { "x-api-key": apiKey },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data?: any[] } | any[];
    const rows = Array.isArray(json) ? json : json?.data ?? [];
    return rows
      .map((row) => {
        const name = row?.name ?? row?.model_name ?? row?.id;
        const provider = row?.creator ?? row?.provider ?? row?.organization ?? "Unknown";
        const evals = row?.evaluations ?? row?.benchmarks ?? {};
        const pricing = row?.pricing ?? {};
        return {
          id: row?.id ?? `${provider}-${name}`,
          name: String(name ?? "Unknown"),
          provider: String(provider ?? "Unknown"),
          pricePer1M: {
            input: numberFromUnknown(pricing?.input ?? pricing?.prompt),
            output: numberFromUnknown(pricing?.output ?? pricing?.completion),
          },
          capabilities: Array.isArray(row?.capabilities) ? row.capabilities : [],
          categories: Array.isArray(row?.tags) ? row.tags : [],
          availability: "available" as const,
          scores: {
            overall: pickScore(evals, ["overall", "intelligence", "aggregate", "average"]),
            coding: pickScore(evals, ["code", "coding"]),
            math: pickScore(evals, ["math"]),
            reasoning: pickScore(evals, ["reasoning"]),
          },
          source: "artificialanalysis" as const,
          rank: numberFromUnknown(row?.rank),
        } satisfies LeaderboardModel;
      })
      .filter((item) => item.name && item.provider);
  } catch {
    return [];
  }
}

export async function fetchOpenRouterRankings(): Promise<LeaderboardModel[]> {
  try {
    const response = await fetch("https://openrouter.ai/rankings");
    if (!response.ok) return [];
    const html = await response.text();
    const lines = stripHtmlToLines(html);
    const results: LeaderboardModel[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/^\d+\.$/.test(line)) continue;
      const rank = Number(line.replace(".", ""));
      const name = lines[i + 1];
      if (!name) continue;
      let provider = "OpenRouter";
      for (let j = i + 1; j < i + 6; j += 1) {
        if (lines[j] === "by" && lines[j + 1]) {
          provider = lines[j + 1].replace(/^\w/, (c) => c.toUpperCase());
          break;
        }
      }
      const overall = Math.max(50, 100 - rank);
      results.push({
        id: `${provider}-${name}`,
        name,
        provider,
        capabilities: [],
        categories: [],
        availability: "available",
        scores: { overall },
        source: "openrouter",
        rank,
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function fetchArenaLeaderboard(): Promise<LeaderboardModel[]> {
  try {
    const response = await fetch("https://arena.ai/leaderboard/");
    if (!response.ok) return [];
    const html = await response.text();
    const lines = stripHtmlToLines(html);
    const results: LeaderboardModel[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/^\d+$/.test(line)) continue;
      const rank = Number(line);
      const name = lines[i + 2] ?? lines[i + 1];
      if (!name) continue;
      results.push({
        id: `arena-${name}`,
        name,
        provider: "Arena",
        capabilities: [],
        categories: [],
        availability: "available",
        scores: { overall: Math.max(50, 100 - rank) },
        source: "arena",
        rank,
      });
    }
    return results;
  } catch {
    return [];
  }
}

function mergeLeaderboardModels(models: LeaderboardModel[]) {
  const merged = new Map<string, LeaderboardModel>();
  for (const model of models) {
    const key = normalizeKey(model.provider, model.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, model);
      continue;
    }
    merged.set(key, {
      ...existing,
      ...model,
      pricePer1M: model.pricePer1M ?? existing.pricePer1M,
      capabilities: model.capabilities.length > 0 ? model.capabilities : existing.capabilities,
      categories: model.categories.length > 0 ? model.categories : existing.categories,
      scores: {
        ...existing.scores,
        ...model.scores,
      },
      rank: model.rank ?? existing.rank,
      source: existing.source === "internal" ? model.source : existing.source,
    });
  }
  return Array.from(merged.values());
}

function mergeWithCatalog(models: LeaderboardModel[]) {
  const catalog = getModelHubCards();
  const catalogMap = new Map(
    catalog.map((item) => [normalizeKey(item.provider, item.name), item])
  );
  const merged = models.map((model) => {
    const card = catalogMap.get(normalizeKey(model.provider, model.name));
    if (!card) return model;
    return {
      ...model,
      capabilities:
        model.capabilities.length > 0 ? model.capabilities : deriveCapabilitiesFromModelCard(card),
      categories:
        model.categories.length > 0 ? model.categories : deriveCategoriesFromModelCard(card),
      availability: model.availability ?? "available",
    };
  });
  const existingKeys = new Set(merged.map((model) => normalizeKey(model.provider, model.name)));
  const internalExtras: LeaderboardModel[] = catalog
    .filter((item) => !existingKeys.has(normalizeKey(item.provider, item.name)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      provider: item.provider,
      capabilities: deriveCapabilitiesFromModelCard(item),
      categories: deriveCategoriesFromModelCard(item),
      availability: "available",
      scores: {
        overall: undefined,
        coding: undefined,
        math: undefined,
        reasoning: undefined,
      },
      source: "internal",
    }));
  return [...merged, ...internalExtras];
}

async function readCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { updatedAt: number; models: LeaderboardModel[] };
    if (!parsed || !Array.isArray(parsed.models)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(models: LeaderboardModel[]) {
  try {
    const payload = JSON.stringify({ updatedAt: Date.now(), models }, null, 2);
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, payload, "utf8");
  } catch {
    // ignore cache write errors
  }
}

export async function getLeaderboardModels() {
  const cached = await readCache();
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return { updatedAt: cached.updatedAt, models: cached.models };
  }

  const [aa, openrouter, arena] = await Promise.all([
    fetchArtificialAnalysisModels(),
    fetchOpenRouterRankings(),
    fetchArenaLeaderboard(),
  ]);

  const merged = mergeWithCatalog(mergeLeaderboardModels([...aa, ...openrouter, ...arena]));
  await writeCache(merged);
  return { updatedAt: Date.now(), models: merged };
}
