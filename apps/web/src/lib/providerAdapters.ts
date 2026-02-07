export type RunModelInput = {
  modelId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  mode?: "fast" | "deep";
  stepsMode?: "brief" | "detailed";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  attachments?: Array<{ name: string; type: string; data: string }>;
};

export type RunModelOutput = {
  text: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  steps?: string[];
  confidence?: number;
  citations?: string[];
  selectionReason?: string;
  gatewayNote?: string;
  usedModel?: string;
};

export async function runModel({
  modelId,
  messages,
  mode = "fast",
  stepsMode = "brief",
  temperature,
  maxTokens,
  signal,
  attachments,
}: RunModelInput): Promise<RunModelOutput> {
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        }))
        .filter((message) => message.content.length > 0)
    : [];
  const lastUser = [...normalizedMessages].reverse().find((message) => message.role === "user");
  const question = lastUser?.content ?? "";
  const response = await fetch("/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      messages: normalizedMessages,
      models: [modelId],
      mode,
      stepsMode,
      temperature,
      maxTokens,
      attachments,
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error("Model request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  let latencyMs: number | undefined;
  let steps: string[] | undefined;
  let confidence: number | undefined;
  let citations: string[] | undefined;
  let selectionReason: string | undefined;
  let gatewayNote: string | undefined;
  let usedModel: string | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const event = JSON.parse(trimmed) as { type: string; payload?: any };
      if (event.type === "result" && event.payload) {
        finalText = event.payload.final ?? "";
        latencyMs = event.payload.durationMs;
        steps = Array.isArray(event.payload.steps) ? event.payload.steps : steps;
        confidence = typeof event.payload.confidence === "number" ? event.payload.confidence : confidence;
        citations = Array.isArray(event.payload.citations) ? event.payload.citations : citations;
        selectionReason =
          typeof event.payload.selectionReason === "string"
            ? event.payload.selectionReason
            : selectionReason;
        gatewayNote =
          typeof event.payload.gatewayNote === "string" ? event.payload.gatewayNote : gatewayNote;
        usedModel = typeof event.payload.usedModel === "string" ? event.payload.usedModel : usedModel;
      }
    }
  }

  if (!finalText) {
    throw new Error("Empty model response");
  }

  return {
    text: finalText,
    latencyMs,
    steps,
    confidence,
    citations,
    selectionReason,
    gatewayNote,
    usedModel,
  };
}

export type AggregatedResult = {
  text: string;
  attribution?: { modelIdsUsed: string[] };
  confidence?: number;
};

function extractShortAnswer(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= 24) return trimmed;
  const line = trimmed.split("\n")[0]?.trim() ?? "";
  if (line.length <= 24) return line;
  return "";
}

export function aggregateFallback(
  question: string,
  results: Array<{ modelId: string; text: string }>
): AggregatedResult {
  const shortAnswers = results
    .map((result) => extractShortAnswer(result.text))
    .filter((answer) => answer.length > 0);

  if (shortAnswers.length > 0) {
    const counts = new Map<string, number>();
    shortAnswers.forEach((answer) => {
      counts.set(answer, (counts.get(answer) ?? 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted[0] && sorted[0][1] > 1) {
      return {
        text: sorted[0][0],
        attribution: { modelIdsUsed: results.map((result) => result.modelId) },
      };
    }
  }

  const scoring = results.map((result) => {
    const words = result.text.split(/\s+/).filter(Boolean).length;
    const hasMath = /[=+\-/*^]/.test(result.text);
    const hasSteps = /step|first|second|therefore|thus/i.test(result.text);
    const score = Math.min(words, 220) + (hasMath ? 30 : 0) + (hasSteps ? 20 : 0);
    return { result, score };
  });
  scoring.sort((a, b) => b.score - a.score);
  const top = scoring[0]?.result;
  return {
    text: top?.text ?? "",
    attribution: { modelIdsUsed: results.map((result) => result.modelId) },
  };
}

export async function runAggregator(params: {
  question: string;
  results: Array<{ modelId: string; text: string }>;
  aggregatorModel?: string;
  temperature?: number;
  maxTokens?: number;
  attachments?: Array<{ name: string; type: string; data: string }>;
}): Promise<AggregatedResult> {
  try {
    const response = await fetch("/api/consensus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: params.question,
        answers: params.results.map((result) => ({
          model: result.modelId,
          final: result.text,
        })),
        aggregatorModel: params.aggregatorModel,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        attachments: params.attachments,
      }),
    });
    if (!response.ok) throw new Error("Aggregator request failed");
    const payload = (await response.json()) as { final: string; confidence?: number };
    return {
      text: payload.final ?? "",
      confidence: payload.confidence,
      attribution: { modelIdsUsed: params.results.map((result) => result.modelId) },
    };
  } catch {
    return aggregateFallback(params.question, params.results);
  }
}
