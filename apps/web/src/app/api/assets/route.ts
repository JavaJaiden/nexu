import { NextResponse } from "next/server";
import {
  type AssetCategory,
  type AssetComplexity,
  type AssetType,
} from "@/lib/assets";
import { getModelHubCards } from "@/lib/modelCatalog";
import {
  assertValidPresetPayload,
  createAsset,
  listAssets,
} from "@/lib/server/labDatabase";
import {
  badRequest,
  getApiAuthContext,
  parseScope,
  serverError,
  unauthorized,
} from "@/lib/server/labApi";

const COMPLEXITIES = new Set<AssetComplexity>(["Simple", "Medium", "Complex", "Enterprise", null]);
const CATEGORIES = new Set<AssetCategory>([
  "Customer Support",
  "Data Analysis",
  "Content Generation",
  "Automation",
  "Research",
  null,
]);

function looksLikeOpenRouterModelId(value: string) {
  return /^[a-z0-9-]+\/[a-z0-9][a-z0-9._:-]*$/i.test(value.trim());
}

function parseTypeFilter(value: string | null): AssetType | AssetType[] | "all" {
  if (!value || value === "all") return "all";
  const parts = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as AssetType[];
  if (parts.length <= 1) return parts[0] ?? "all";
  return parts;
}

export async function GET(req: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const scope = parseScope(searchParams.get("scope"));
  const type = parseTypeFilter(searchParams.get("type"));
  const projectId = searchParams.get("projectId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const categoryParam = searchParams.get("category");
  const complexityParam = searchParams.get("complexity");
  const sortParam = searchParams.get("sort");
  const ownerOnly = searchParams.get("owner") === "me";
  const favoritesOnly = searchParams.get("favorites") === "1";

  const category =
    categoryParam && categoryParam !== "all" ? (categoryParam as AssetCategory) : "all";
  const complexity =
    complexityParam && complexityParam !== "all"
      ? (complexityParam as AssetComplexity)
      : "all";
  const sort =
    sortParam === "most_used" || sortParam === "highest_rated" || sortParam === "recent"
      ? sortParam
      : "recent";

  try {
    const assets = await listAssets(ctx, {
      scope,
      type,
      projectId,
      search,
      category,
      complexity,
      sort,
      ownerOnly,
      favoritesOnly,
    });
    return NextResponse.json({
      assets,
      organizationEnabled: Boolean(ctx.orgId),
    });
  } catch {
    return serverError("Failed to load assets.");
  }
}

export async function POST(req: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();

  let body: {
    scope?: string;
    projectId?: string;
    type?: AssetType;
    name?: string;
    description?: string;
    tags?: string[];
    category?: AssetCategory;
    complexity?: AssetComplexity;
    rating?: number | null;
    useCount?: number;
    payload?: Record<string, unknown>;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid asset payload.");
  }

  if (!body?.name || !body.name.trim()) return badRequest("Asset name is required.");
  if (!body.type) return badRequest("Asset type is required.");

  const scope = parseScope(body.scope ?? "private");
  const category = typeof body.category === "undefined" ? null : body.category;
  const complexity = typeof body.complexity === "undefined" ? null : body.complexity;

  if (!COMPLEXITIES.has(complexity)) {
    return badRequest("Invalid complexity value.");
  }
  if (!CATEGORIES.has(category)) {
    return badRequest("Invalid category value.");
  }

  let payload = (body.payload ?? {}) as Record<string, unknown>;
  if (body.type === "model_preset") {
    try {
      const preset = assertValidPresetPayload(payload);
      const validIds = new Set(getModelHubCards().map((model) => model.id));
      const invalidId = preset.modelIds.find(
        (id) => !validIds.has(id) && !looksLikeOpenRouterModelId(id)
      );
      if (invalidId) {
        return badRequest(`Unknown model id: ${invalidId}`);
      }
      payload = preset as unknown as Record<string, unknown>;
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid preset payload.");
    }
  }

  try {
    const asset = await createAsset(ctx, {
      scope,
      projectId: body.projectId,
      type: body.type,
      name: body.name,
      description: body.description,
      tags: body.tags ?? [],
      category,
      complexity,
      rating: body.rating ?? null,
      useCount: body.useCount,
      payload,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create asset.";
    if (message.includes("required") || message.includes("match") || message.includes("found")) {
      return badRequest(message);
    }
    return serverError(message);
  }
}
