import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { z } from "zod";
import {
  createOpenRouterProvider,
  resolveGatewayModel,
  resolveRouterModel,
} from "@/lib/aiGateway";
import { buildExternalContext } from "@/lib/externalContext";
import { consumeUserOpenRouterAccess } from "@/lib/server/settingsDatabase";

const subjectKeywords: Array<{ subject: string; keywords: RegExp }> = [
  {
    subject: "Mathematics",
    keywords:
      /(integral|derivative|limit|algebra|geometry|calculus|equation|sin|cos|tan)/i,
  },
  {
    subject: "Physics",
    keywords: /(velocity|acceleration|force|energy|momentum|gravity|newton)/i,
  },
  {
    subject: "Computer Science",
    keywords:
      /(python|javascript|typescript|java|bug|debug|compile|algorithm|function|stack)/i,
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
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let userProvider: ReturnType<typeof createOpenRouterProvider>;
  try {
    const access = await consumeUserOpenRouterAccess(userId);
    userProvider = createOpenRouterProvider(access.apiKey);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to prepare OpenRouter access.";
    const status = message.toLowerCase().includes("limit") ? 429 : 500;
    return new Response(message, { status });
  }

  const {
    question,
    models,
    mode,
    maxSameModel,
    attachments,
    stepsMode,
    messages,
    temperature,
    maxTokens,
  } = (await req.json()) as {
    question: string;
    models: string[];
    mode?: "fast" | "deep";
    maxSameModel?: number;
    attachments?: Array<{ name: string; type: string; data: string }>;
    stepsMode?: "brief" | "detailed";
    messages?: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
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
  const normalizedStepsMode = stepsMode === "detailed" ? "detailed" : "brief";
  const minSteps = normalizedStepsMode === "detailed" ? 4 : 2;
  const maxSteps = normalizedStepsMode === "detailed" ? 8 : 5;
  const maxSame =
    typeof maxSameModel === "number" && maxSameModel > 0 ? maxSameModel : 5;
  const normalizedTemperature =
    typeof temperature === "number" && Number.isFinite(temperature)
      ? Math.min(1, Math.max(0, temperature))
      : 0.3;
  const normalizedMaxTokens =
    typeof maxTokens === "number" && Number.isFinite(maxTokens)
      ? Math.max(128, Math.min(4096, Math.round(maxTokens)))
      : 1600;
  const usageCounts: Record<string, number> = {};
  const externalContext = await buildExternalContext(
    question,
    attachments ?? []
  );
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => ({
          role:
            message.role === "assistant" || message.role === "system"
              ? message.role
              : "user",
          content: message.content.trim(),
        }))
        .filter((message) => message.content.length > 0)
    : [];
  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const conversationMessages =
    lastMessage?.role === "user" && lastMessage.content === question
      ? normalizedMessages.slice(0, -1)
      : normalizedMessages;
  const conversation =
    conversationMessages.length > 0
      ? conversationMessages
          .map((message) => {
            const label =
              message.role === "assistant"
                ? "Assistant"
                : message.role === "system"
                  ? "System"
                  : "User";
            return `${label}: ${message.content}`;
          })
          .join("\n")
      : "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const write = (value: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      };

      write({ type: "start", payload: { subject, mode: selectedMode } });

      const tasks = uniqueModels.map(async (requestedLabel) => {
        const normalized =
          typeof requestedLabel === "string" ? requestedLabel : "Nexus-Core";
        const mapped = modelMap[normalized];
        const fallbackLabel = mapped?.label ?? "Nexus-Core";
        const fallbackModelId = mapped?.modelId ?? "gpt-4o-mini";
        const isRouter = normalized.startsWith("Nexus-");
        let selectionReason = isRouter
          ? `Routed by ${normalized} to diversify model usage.`
          : "User-selected model from Model Hub.";
        let gateway = isRouter
          ? resolveRouterModel(normalized, usageCounts, maxSame, userProvider)
          : resolveGatewayModel(
              normalized,
              fallbackLabel,
              fallbackModelId,
              userProvider
            );

        const currentCount = usageCounts[gateway.resolvedLabel] ?? 0;
        if (currentCount >= maxSame) {
          const overuseLabel = gateway.resolvedLabel;
          const reroute = resolveRouterModel(
            "Nexus-Core",
            usageCounts,
            maxSame,
            userProvider
          );
          gateway = {
            ...reroute,
            fallbackNote: `Rerouted from ${overuseLabel} to avoid overuse.`,
          };
          selectionReason = `Rerouted from ${overuseLabel} to avoid using the same model more than ${maxSame} times.`;
        }
        usageCounts[gateway.resolvedLabel] =
          (usageCounts[gateway.resolvedLabel] ?? 0) + 1;
        const startedAt = Date.now();
        const generationConfig = {
          temperature: normalizedTemperature,
          maxTokens: normalizedMaxTokens,
        } as any;
        const result = await (async () => {
          try {
            return await generateObject({
              model: gateway.model,
              schema: z.object({
                steps: z.array(z.string()).min(minSteps).max(maxSteps),
                final: z.string(),
                confidence: z.number().min(0).max(1),
              }),
              ...generationConfig,
              system:
                normalizedStepsMode === "detailed"
                  ? "You are a homework assistant. Provide clear, student-friendly steps with brief reasoning and a final answer."
                  : "You are a homework assistant. Provide clear, concise steps and a final answer.",
              prompt: `Subject: ${subject.subject}\nMode: ${selectedMode}\n${
                conversation ? `Conversation:\n${conversation}\n\n` : ""
              }Question: ${question}\n${
                externalContext ? `\nContext:\n${externalContext}\n` : ""
              }\nReturn ${minSteps}-${maxSteps} steps, a final answer, and a confidence score between 0 and 1.`,
            });
          } catch {
            const fallbackGateway = resolveRouterModel(
              "Nexus-Core",
              usageCounts,
              maxSame,
              userProvider
            );
            gateway = {
              ...fallbackGateway,
              fallbackNote: `Primary model ${normalized} failed to return structured output. Routed to ${fallbackGateway.resolvedLabel}.`,
            };
            usageCounts[gateway.resolvedLabel] =
              (usageCounts[gateway.resolvedLabel] ?? 0) + 1;
            selectionReason = `Fallback to ${gateway.resolvedLabel} after structured output failure from ${normalized}.`;
            return await generateObject({
              model: gateway.model,
              schema: z.object({
                steps: z.array(z.string()).min(minSteps).max(maxSteps),
                final: z.string(),
                confidence: z.number().min(0).max(1),
              }),
              ...generationConfig,
              system:
                normalizedStepsMode === "detailed"
                  ? "You are a homework assistant. Provide clear, student-friendly steps with brief reasoning and a final answer."
                  : "You are a homework assistant. Provide clear, concise steps and a final answer.",
              prompt: `Subject: ${subject.subject}\nMode: ${selectedMode}\n${
                conversation ? `Conversation:\n${conversation}\n\n` : ""
              }Question: ${question}\n${
                externalContext ? `\nContext:\n${externalContext}\n` : ""
              }\nReturn ${minSteps}-${maxSteps} steps, a final answer, and a confidence score between 0 and 1.`,
            });
          }
        })();
        const durationMs = Date.now() - startedAt;

        const generated = result.object as {
          steps: string[];
          final: string;
          confidence: number;
        };

        write({
          type: "result",
          payload: {
            requestedModel: normalized,
            model: normalized,
            usedModel: gateway.resolvedLabel,
            steps: generated.steps,
            final: generated.final,
            confidence: generated.confidence,
            durationMs,
            citations: [
              `Model: ${gateway.resolvedLabel}`,
              `Time: ${formatLatency(durationMs)}`,
            ],
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
