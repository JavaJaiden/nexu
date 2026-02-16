import { NextResponse } from "next/server";

const OPENROUTER_BASE_URL =
  process.env.OR_BASE_URL ?? "https://openrouter.ai/api/v1";

type OpenRouterModelRecord = {
  id?: string;
  architecture?: {
    modality?: string;
  };
};

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isModelId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.includes("/") &&
    value.trim().length > 0
  );
}

function toModalityTokens(raw: string) {
  return raw
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function supportsTextOutput(model: OpenRouterModelRecord) {
  const modelId = model.id?.toLowerCase().trim() ?? "";
  const modality = model.architecture?.modality?.toLowerCase().trim() ?? "";
  const [, output = ""] = modality.split("->").map((part) => part.trim());
  const tokens = toModalityTokens(output || modality);

  if (tokens.length > 0) {
    const hasText = tokens.includes("text");
    const hasEmbedding =
      tokens.includes("embedding") || tokens.includes("embeddings");
    const hasVector = tokens.includes("vector") || tokens.includes("vectors");
    if (hasEmbedding || hasVector) return false;
    return hasText;
  }

  // Heuristic fallback for records without clear modality metadata.
  if (
    /(embedding|embeddings|\/embed|imagen|flux|recraft|voyage|titan-embed|safeguard|moderation)/i.test(
      modelId
    )
  ) {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    const response = await fetch(
      `${normalizeBaseUrl(OPENROUTER_BASE_URL)}/models`,
      {
        headers: {
          Accept: "application/json",
          ...(process.env.OR_API_KEY
            ? { Authorization: `Bearer ${process.env.OR_API_KEY}` }
            : {}),
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { modelIds: [], stale: true },
        { status: 200 }
      );
    }

    const payload = (await response.json()) as {
      data?: OpenRouterModelRecord[];
    };
    const records = Array.isArray(payload.data) ? payload.data : [];
    const modelIds = Array.from(
      new Set(
        records
          .filter((record) => supportsTextOutput(record))
          .map((record) => record.id)
          .filter(isModelId)
          .map((id) => id.trim())
          .sort((a, b) => a.localeCompare(b))
      )
    );

    if (modelIds.length === 0) {
      return NextResponse.json(
        { modelIds: [], stale: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ modelIds, stale: false }, { status: 200 });
  } catch {
    return NextResponse.json(
      { modelIds: [], stale: true },
      { status: 200 }
    );
  }
}
