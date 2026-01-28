import { generateObject } from "ai";
import { z } from "zod";
import { resolveGatewayModel, resolveRouterModel } from "@/lib/aiGateway";
import { buildExternalContext } from "@/lib/externalContext";

function formatLatency(ms: number) {
  if (!Number.isFinite(ms)) return "unknown";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  const { question, answers, aggregatorModel, attachments } = (await req.json()) as {
    question: string;
    answers: Array<{ model: string; final: string }>;
    aggregatorModel?: string;
    attachments?: Array<{ name: string; type: string; data: string }>;
  };

  if (!question || !Array.isArray(answers) || answers.length === 0) {
    return new Response("Missing question or answers", { status: 400 });
  }

  const aggregatorLabel = typeof aggregatorModel === "string" ? aggregatorModel : null;
  const fallbackLabel = "Nexus-Core";
  const fallbackModelId = "gpt-4o-mini";
  const externalContext = await buildExternalContext(question, attachments ?? []);
  const isRouter = aggregatorLabel ? aggregatorLabel.startsWith("Nexus-") : true;
  const gateway = aggregatorLabel
    ? isRouter
      ? resolveRouterModel(aggregatorLabel, {}, 3)
      : resolveGatewayModel(aggregatorLabel, fallbackLabel, fallbackModelId)
    : resolveRouterModel("Nexus-Core", {}, 3);

  const startedAt = Date.now();
  const result = await generateObject({
    model: gateway.model,
    schema: z.object({
      steps: z.array(z.string()).min(2).max(6),
      final: z.string(),
      confidence: z.number().min(0).max(1),
    }),
    system:
      "You are an aggregator. Combine multiple model answers into one clear, concise response with 2-6 steps and a final answer.",
    prompt: `Question: ${question}\n${
      externalContext ? `\nContext:\n${externalContext}\n` : ""
    }\nModel answers:\n${answers
      .map((answer, index) => `Answer ${index + 1} (${answer.model}): ${answer.final}`)
      .join("\n")}\nReturn 2-6 steps, a final answer, and a confidence score between 0 and 1.`,
  });
  const durationMs = Date.now() - startedAt;
  const selectionReason = aggregatorLabel
    ? `User-selected aggregator (${aggregatorLabel}).`
    : "Auto-selected Nexus aggregator.";

  return Response.json({
    model: gateway.resolvedLabel,
    steps: result.object.steps,
    final: result.object.final,
    confidence: result.object.confidence,
    durationMs,
    gatewayNote: gateway.fallbackNote,
    selectionReason,
    citations: [`Model: ${gateway.resolvedLabel}`, `Time: ${formatLatency(durationMs)}`],
  });
}
