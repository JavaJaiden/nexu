import { generateObject } from "ai";
import { z } from "zod";
import { resolveGatewayModel, resolveRouterModel } from "@/lib/aiGateway";
import { buildExternalContext } from "@/lib/externalContext";

const subjectKeywords: Array<{ subject: string; keywords: RegExp }> = [
  {
    subject: "Mathematics",
    keywords: /(integral|derivative|limit|algebra|geometry|calculus|equation|sin|cos|tan)/i,
  },
  {
    subject: "Physics",
    keywords: /(velocity|acceleration|force|energy|momentum|gravity|newton)/i,
  },
  {
    subject: "Computer Science",
    keywords: /(python|javascript|typescript|java|bug|debug|compile|algorithm|function|stack)/i,
  },
  {
    subject: "Writing",
    keywords: /(thesis|outline|essay|paragraph|tone|rewrite|summarize|edit)/i,
  },
  {
    subject: "History",
    keywords: /(revolution|war|treaty|empire|ancient|medieval|histor(y|ical))/i,
  },
];

const modelMap: Record<string, { label: string; modelId: string }> = {
  "Nexus-Core": { label: "Nexus-Core", modelId: "gpt-4o-mini" },
  "Nexus-Math": { label: "Nexus-Math", modelId: "gpt-4o-mini" },
  "Nexus-Code": { label: "Nexus-Code", modelId: "gpt-4o-mini" },
  "Nexus-Write": { label: "Nexus-Write", modelId: "gpt-4o-mini" },
};

function detectSubject(question: string) {
  const match = subjectKeywords.find((entry) => entry.keywords.test(question));
  if (match) return { subject: match.subject, confidence: 0.78 };
  return { subject: "General", confidence: 0.6 };
}

function formatLatency(ms: number) {
  if (!Number.isFinite(ms)) return "unknown";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  const { question, models, mode, maxSameModel, attachments } = (await req.json()) as {
    question: string;
    models: string[];
    mode?: "fast" | "deep";
    maxSameModel?: number;
    attachments?: Array<{ name: string; type: string; data: string }>;
  };

  if (!question || !Array.isArray(models) || models.length === 0) {
    return new Response("Missing question or models", { status: 400 });
  }

  const uniqueModels = Array.from(
    new Set(
      models
        .filter((model): model is string => typeof model === "string")
        .map((model) => model.trim())
        .filter(Boolean)
    )
  );

  if (uniqueModels.length === 0) {
    return new Response("Missing question or models", { status: 400 });
  }

  const subject = detectSubject(question);
  const selectedMode = mode ?? "fast";
  const maxSame = typeof maxSameModel === "number" && maxSameModel > 0 ? maxSameModel : 5;
  const usageCounts: Record<string, number> = {};
  const externalContext = await buildExternalContext(question, attachments ?? []);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const write = (value: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      };

      write({ type: "start", payload: { subject, mode: selectedMode } });

      const tasks = uniqueModels.map(async (requestedLabel) => {
        const normalized = typeof requestedLabel === "string" ? requestedLabel : "Nexus-Core";
        const mapped = modelMap[normalized];
        const fallbackLabel = mapped?.label ?? "Nexus-Core";
        const fallbackModelId = mapped?.modelId ?? "gpt-4o-mini";
        const isRouter = normalized.startsWith("Nexus-");
        let selectionReason = isRouter
          ? `Routed by ${normalized} to diversify model usage.`
          : "User-selected model from Model Hub.";
        let gateway = isRouter
          ? resolveRouterModel(normalized, usageCounts, maxSame)
          : resolveGatewayModel(normalized, fallbackLabel, fallbackModelId);

        const currentCount = usageCounts[gateway.resolvedLabel] ?? 0;
        if (currentCount >= maxSame) {
          const overuseLabel = gateway.resolvedLabel;
          const reroute = resolveRouterModel("Nexus-Core", usageCounts, maxSame);
          gateway = {
            ...reroute,
            fallbackNote: `Rerouted from ${overuseLabel} to avoid overuse.`,
          };
          selectionReason = `Rerouted from ${overuseLabel} to avoid using the same model more than ${maxSame} times.`;
        }
        usageCounts[gateway.resolvedLabel] = (usageCounts[gateway.resolvedLabel] ?? 0) + 1;
        const startedAt = Date.now();
        const result = await generateObject({
          model: gateway.model,
          schema: z.object({
            steps: z.array(z.string()).min(2).max(6),
            final: z.string(),
            confidence: z.number().min(0).max(1),
          }),
          system: "You are a homework assistant. Provide clear, concise steps and a final answer.",
          prompt: `Subject: ${subject.subject}\nMode: ${selectedMode}\nQuestion: ${question}\n${
            externalContext ? `\nContext:\n${externalContext}\n` : ""
          }\nReturn 2-6 steps, a final answer, and a confidence score between 0 and 1.`,
        });
        const durationMs = Date.now() - startedAt;

        write({
          type: "result",
          payload: {
            requestedModel: normalized,
            model: normalized,
            usedModel: gateway.resolvedLabel,
            steps: result.object.steps,
            final: result.object.final,
            confidence: result.object.confidence,
            durationMs,
            citations: [`Model: ${gateway.resolvedLabel}`, `Time: ${formatLatency(durationMs)}`],
            gatewayNote: gateway.fallbackNote,
            selectionReason,
          },
        });
      });

      Promise.allSettled(tasks).then(() => {
        write({ type: "done" });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
