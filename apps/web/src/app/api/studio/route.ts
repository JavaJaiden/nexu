import { convertToCoreMessages, generateObject, streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
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

const modelMap: Record<string, { label: string; modelId: string; rationale: string }> = {
  Mathematics: {
    label: "Nexus-Math",
    modelId: "gpt-4o-mini",
    rationale: "High accuracy on quantitative reasoning with fast latency.",
  },
  Physics: {
    label: "Nexus-Math",
    modelId: "gpt-4o-mini",
    rationale: "Strong performance on physics problem solving.",
  },
  "Computer Science": {
    label: "Nexus-Code",
    modelId: "gpt-4o-mini",
    rationale: "Reliable for code reasoning and debugging tasks.",
  },
  Writing: {
    label: "Nexus-Write",
    modelId: "gpt-4o-mini",
    rationale: "Optimized for structured writing support.",
  },
  History: {
    label: "Nexus-Write",
    modelId: "gpt-4o-mini",
    rationale: "Performs well on explanatory writing and context.",
  },
  General: {
    label: "Nexus-Core",
    modelId: "gpt-4o-mini",
    rationale: "Balanced performance across mixed subjects.",
  },
};

const modelLabelToId: Record<string, string> = Object.values(modelMap).reduce(
  (acc, entry) => {
    acc[entry.label] = entry.modelId;
    return acc;
  },
  {} as Record<string, string>
);

function detectSubject(question: string) {
  const match = subjectKeywords.find((entry) => entry.keywords.test(question));
  if (match) {
    return { subject: match.subject, confidence: 0.78 };
  }
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

  const { messages, mode, preferredModel, preferredModels, aggregatorModel, attachments } =
    (await req.json()) as {
      messages: Array<{ role: string; content: string }>;
      mode?: "fast" | "deep";
      preferredModel?: string;
      preferredModels?: string[];
      aggregatorModel?: string;
      attachments?: Array<{ name: string; type: string; data: string }>;
    };

  const selectedMode = mode ?? "fast";
  const inputMessages = messages ?? [];
  const preferredLabel = typeof preferredModel === "string" ? preferredModel : null;
  const preferredStack = Array.isArray(preferredModels)
    ? preferredModels.filter((entry) => typeof entry === "string")
    : [];
  const normalizedStack = Array.from(
    new Set(preferredStack.filter((entry) => entry && entry !== "auto"))
  );
  const aggregatorLabel = typeof aggregatorModel === "string" ? aggregatorModel : null;
  const preferredIsNexus = preferredLabel ? preferredLabel in modelLabelToId : false;
  const preferredIsExternal = Boolean(preferredLabel && !preferredIsNexus && preferredLabel !== "auto");
  const usageCounts: Record<string, number> = {};

  const externalContext = await buildExternalContext(
    inputMessages.map((message) => message.content).join("\n"),
    attachments ?? []
  );

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `You are the Nexus routing assistant. For each user question:
1) Call detectSubject with the question.
2) Call routeModel with the detected subject and the mode (${selectedMode}).
3) Call solveQuestion with the question, subject, chosen model(s), and mode.
4) Provide a concise student-facing response that references the tool outputs and any aggregation.
Keep answers structured and homework-safe.`,
    toolChoice: "required",
    messages: convertToCoreMessages(inputMessages),
    maxSteps: 5,
    tools: {
      detectSubject: tool({
        description: "Detect the subject area for a homework question.",
        parameters: z.object({
          question: z.string(),
        }),
        execute: async ({ question }) => {
          return detectSubject(question);
        },
      }),
      routeModel: tool({
        description: "Choose the best model for a subject and mode.",
        parameters: z.object({
          subject: z.string(),
          mode: z.enum(["fast", "deep"]).optional(),
        }),
        execute: async ({ subject, mode }) => {
          const fallbackEntry = modelMap[subject] ?? modelMap.General;
          const entry = preferredIsNexus
            ? Object.values(modelMap).find((item) => item.label === preferredLabel) ?? fallbackEntry
            : fallbackEntry;
          const modeNote = mode === "deep" ? "Deep mode prioritizes reasoning." : "Fast mode prioritizes speed.";
          const baseConfidence = subject === "General" ? 0.68 : 0.78;
          const confidence =
            mode === "deep" ? Math.min(0.95, baseConfidence + 0.08) : baseConfidence;
          const selectionNote = preferredIsExternal
            ? "User-selected external model via Model Hub."
            : preferredIsNexus
              ? "User-selected Nexus router."
              : "";
          const stackNote =
            normalizedStack.length > 0 ? `User stacked ${normalizedStack.length} models.` : "";
          return {
            model:
              normalizedStack.length > 0
                ? normalizedStack.join(", ")
                : preferredIsExternal
                  ? preferredLabel
                  : entry.label,
            modelId: entry.modelId,
            rationale: `${entry.rationale} ${modeNote} ${selectionNote} ${stackNote}`.trim(),
            mode: mode ?? selectedMode,
            confidence,
          };
        },
      }),
      solveQuestion: tool({
        description: "Solve the question with a structured, step-by-step answer.",
        parameters: z.object({
          question: z.string(),
          subject: z.string().optional(),
          model: z.string().optional(),
          models: z.array(z.string()).optional(),
          mode: z.enum(["fast", "deep"]).optional(),
        }),
        execute: async ({ question, subject, model, mode }) => {
          const selected = modelMap[subject ?? "General"] ?? modelMap.General;
          const fallbackModelId = selected.modelId;
          const fallbackLabel = selected.label;
          const maxSame = 3;
          const fallbackLabelOverride = preferredIsExternal
            ? preferredLabel
            : preferredIsNexus
              ? preferredLabel
              : model ?? selected.label;
          const stackedLabels =
            normalizedStack.length > 0
              ? normalizedStack
              : [fallbackLabelOverride].filter((entry): entry is string => Boolean(entry));
          const solveOutputs = [];

          for (const label of stackedLabels) {
            const isRouter = label.startsWith("Nexus-");
            let selectionReason = isRouter
              ? `Routed by ${label} to diversify model usage.`
              : "User-selected model from Model Hub.";
            let gateway = isRouter
              ? resolveRouterModel(label, usageCounts, maxSame)
              : resolveGatewayModel(label, fallbackLabel, fallbackModelId);

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
              prompt: `Subject: ${subject ?? "General"}\nMode: ${mode ?? selectedMode}\nQuestion: ${question}\n${
                externalContext ? `\nContext:\n${externalContext}\n` : ""
              }\nReturn 2-6 steps, a final answer, and a confidence score between 0 and 1.`,
            });
            const durationMs = Date.now() - startedAt;

            solveOutputs.push({
              steps: result.object.steps,
              final: result.object.final,
              confidence: result.object.confidence,
              citations: [`Model: ${gateway.resolvedLabel}`, `Time: ${formatLatency(durationMs)}`],
              durationMs,
              model: gateway.resolvedLabel,
              gatewayNote: gateway.fallbackNote,
              selectionReason,
              kind: "solve",
            });
          }

          const shouldAggregate = stackedLabels.length > 1 || Boolean(aggregatorLabel);
          if (!shouldAggregate) return solveOutputs;

          const aggregatorSource = aggregatorLabel && aggregatorLabel !== "auto" ? aggregatorLabel : "Nexus-Core";
          const aggregatorIsRouter = aggregatorSource.startsWith("Nexus-");
          const aggregatorGateway = aggregatorIsRouter
            ? resolveRouterModel(aggregatorSource, usageCounts, maxSame)
            : resolveGatewayModel(aggregatorSource, fallbackLabel, fallbackModelId);
          const aggregatorStarted = Date.now();
          const aggregateResult = await generateObject({
            model: aggregatorGateway.model,
            schema: z.object({
              steps: z.array(z.string()).min(2).max(6),
              final: z.string(),
              confidence: z.number().min(0).max(1),
            }),
            system:
              "You are an aggregator. Combine multiple model answers into one clear, concise response with 2-6 steps and a final answer.",
            prompt: `Subject: ${subject ?? "General"}\nMode: ${mode ?? selectedMode}\nQuestion: ${question}\n${
              externalContext ? `\nContext:\n${externalContext}\n` : ""
            }\nModel answers:\n${solveOutputs
              .map((solve, index) => `Answer ${index + 1} (${solve.model}): ${solve.final}`)
              .join("\n")}\nReturn 2-6 steps, a final answer, and a confidence score between 0 and 1.`,
          });
          const aggregateDuration = Date.now() - aggregatorStarted;
          const aggregateSelectionReason =
            aggregatorLabel && aggregatorLabel !== "auto"
              ? `User-selected aggregator (${aggregatorSource}).`
              : "Auto-selected Nexus aggregator.";

          return [
            ...solveOutputs,
            {
              steps: aggregateResult.object.steps,
              final: aggregateResult.object.final,
              confidence: aggregateResult.object.confidence,
              citations: [
                `Model: ${aggregatorGateway.resolvedLabel}`,
                `Time: ${formatLatency(aggregateDuration)}`,
              ],
              durationMs: aggregateDuration,
              model: aggregatorGateway.resolvedLabel,
              gatewayNote: aggregatorGateway.fallbackNote,
              selectionReason: aggregateSelectionReason,
              kind: "aggregate",
            },
          ];
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
