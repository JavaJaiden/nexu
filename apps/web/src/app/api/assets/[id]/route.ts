import { NextResponse } from "next/server";
import { getModelHubCards } from "@/lib/modelCatalog";
import {
  assertValidPresetPayload,
  deleteAsset,
  getAssetById,
  updateAsset,
} from "@/lib/server/labDatabase";
import {
  badRequest,
  forbidden,
  getApiAuthContext,
  serverError,
  unauthorized,
} from "@/lib/server/labApi";

function looksLikeOpenRouterModelId(value: string) {
  return /^[a-z0-9-]+\/[a-z0-9][a-z0-9._:-]*$/i.test(value.trim());
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  try {
    const asset = await getAssetById(ctx, id);
    if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    return NextResponse.json({ asset });
  } catch {
    return serverError("Failed to load asset.");
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  let body: {
    name?: string;
    description?: string;
    tags?: string[];
    category?: any;
    complexity?: any;
    rating?: number | null;
    useCount?: number;
    payload?: Record<string, unknown>;
    projectId?: string | null;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid asset update payload.");
  }

  try {
    const existing = await getAssetById(ctx, id);
    if (!existing) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    let payload = body.payload;
    if (existing.type === "model_preset" && body.payload) {
      const preset = assertValidPresetPayload(body.payload);
      const validIds = new Set(getModelHubCards().map((model) => model.id));
      const invalid = preset.modelIds.find(
        (modelId) =>
          !validIds.has(modelId) && !looksLikeOpenRouterModelId(modelId)
      );
      if (invalid) return badRequest(`Unknown model id: ${invalid}`);
      payload = preset as unknown as Record<string, unknown>;
    }

    const asset = await updateAsset(ctx, id, {
      name: body.name,
      description: body.description,
      tags: body.tags,
      category: body.category,
      complexity: body.complexity,
      rating: body.rating,
      useCount: body.useCount,
      payload,
      projectId: body.projectId,
    });

    if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update asset.";
    if (message === "Forbidden") return forbidden();
    if (message.includes("found") || message.includes("match")) return badRequest(message);
    return serverError(message);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  try {
    const deleted = await deleteAsset(ctx, id);
    if (!deleted) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete asset.";
    if (message === "Forbidden") return forbidden();
    return serverError(message);
  }
}
