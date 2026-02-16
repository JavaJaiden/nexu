"use client";

import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText as FileTextIcon,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import type { ChatMessage, MessageBubbleProps, SolveOutput } from "./types";

function formatLatency(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isImageAttachment(attachment: { name: string; type: string }) {
  return (
    attachment.type.startsWith("image/") ||
    /\.(apng|avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i.test(
      attachment.name
    )
  );
}

function UserAttachmentPreview({
  attachment,
  onOpenImage,
}: {
  attachment: { name: string; type: string; data: string };
  onOpenImage?: (src: string, name: string) => void;
}) {
  const isImage = isImageAttachment(attachment);
  const previewSrc = isImage
    ? `data:${attachment.type || "application/octet-stream"};base64,${attachment.data}`
    : "";
  const fileLabel = (attachment.type || "file").split("/")[1] ?? "file";

  return (
    <YStack
      width={144}
      gap="$xs"
      padding="$xs"
      backgroundColor="rgba(255,255,255,0.08)"
      borderRadius="$md"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.2)"
    >
      <YStack
        height={92}
        borderRadius="$sm"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.2)"
        overflow="hidden"
        position="relative"
        backgroundColor="rgba(0,0,0,0.16)"
      >
        {isImage ? (
          <button
            type="button"
            onClick={() => onOpenImage?.(previewSrc, attachment.name)}
            aria-label={`Open ${attachment.name} preview`}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              border: "none",
              padding: 0,
              background: "transparent",
              cursor: onOpenImage ? "zoom-in" : "default",
            }}
          >
            <Image
              src={previewSrc}
              alt={attachment.name}
              fill
              unoptimized
              sizes="144px"
              loading="lazy"
              style={{ objectFit: "cover" }}
            />
          </button>
        ) : (
          <YStack
            alignItems="center"
            justifyContent="center"
            flex={1}
            gap="$xs"
          >
            <FileTextIcon size={18} color="rgba(255,255,255,0.82)" />
            <Text fontSize={10} color="rgba(255,255,255,0.82)" fontWeight="600">
              {fileLabel.toUpperCase()}
            </Text>
          </YStack>
        )}
      </YStack>
      <Text fontSize={11} color="$background" numberOfLines={1} maxWidth={134}>
        {attachment.name}
      </Text>
    </YStack>
  );
}

function SolveStep({ step, index }: { step: string; index: number }) {
  return (
    <XStack gap="$sm" alignItems="flex-start">
      <Text fontSize={12} color="$textMuted" fontWeight="600" minWidth={20}>
        {index + 1}.
      </Text>
      <Text
        fontSize={13}
        color="$color"
        flex={1}
        lineHeight={20}
        whiteSpace="pre-wrap"
      >
        {step}
      </Text>
    </XStack>
  );
}

function SolveCard({
  solve,
  showSteps,
  showCitations,
}: {
  solve: SolveOutput;
  showSteps: boolean;
  showCitations: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasSteps = solve.steps.length > 0;

  return (
    <YStack
      gap="$sm"
      padding="$md"
      backgroundColor="$backgroundSecondary"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$xs">
          <Sparkles size={14} color="var(--colorTextMuted)" />
          <Text fontSize={13} fontWeight="600" color="$color">
            {solve.model ?? "AI"}
          </Text>
          {typeof solve.confidence === "number" && (
            <Text fontSize={11} color="$success">
              {Math.round(solve.confidence * 100)}% confidence
            </Text>
          )}
        </XStack>
        {hasSteps && (
          <Button
            size="$2"
            backgroundColor="transparent"
            borderWidth={0}
            color="$textMuted"
            onPress={() => setExpanded(!expanded)}
            icon={
              expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            }
          />
        )}
      </XStack>

      {showCitations && (
        <XStack gap="$sm" flexWrap="wrap">
          <Text fontSize={11} color="$textMuted">
            {solve.model ?? "Model"}
          </Text>
          <Text fontSize={11} color="$textMuted">
            •
          </Text>
          <XStack alignItems="center" gap="$xs">
            <Clock size={11} color="var(--colorTextMuted)" />
            <Text fontSize={11} color="$textMuted">
              {formatLatency(solve.durationMs)}
            </Text>
          </XStack>
        </XStack>
      )}

      {solve.selectionReason && (
        <Text fontSize={12} color="$textMuted" fontStyle="italic">
          {solve.selectionReason}
        </Text>
      )}

      {expanded && showSteps && hasSteps && (
        <YStack gap="$xs" marginTop="$xs">
          {solve.steps.map((step, index) => (
            <SolveStep
              key={`${solve.model ?? "model"}-step-${step}`}
              step={step}
              index={index}
            />
          ))}
        </YStack>
      )}

      <YStack
        padding="$md"
        backgroundColor="$background"
        borderRadius="$sm"
        borderWidth={1}
        borderColor="$border"
        marginTop="$xs"
      >
        <Text fontSize={12} color="$textMuted" marginBottom="$xs">
          Final Answer
        </Text>
        <Text
          fontSize={15}
          fontWeight="600"
          color="$color"
          lineHeight={22}
          whiteSpace="pre-wrap"
        >
          {solve.final}
        </Text>
      </YStack>
    </YStack>
  );
}

function FinalAnswerCard({
  answer,
  attribution,
  details,
  confidence,
  isAggregated,
  baseSolves,
  showSteps,
  showCitations,
  onToggleIndividual,
  showIndividual,
}: {
  answer: string;
  attribution?: string | null;
  details?: string[];
  confidence?: number | null;
  isAggregated?: boolean;
  baseSolves?: SolveOutput[];
  showSteps: boolean;
  showCitations: boolean;
  onToggleIndividual?: () => void;
  showIndividual?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = details && details.length > 0;
  const hasIndividualResponses = baseSolves && baseSolves.length >= 1;

  return (
    <YStack
      gap="$sm"
      padding="$lg"
      backgroundColor={
        isAggregated ? "rgba(34, 197, 94, 0.08)" : "$backgroundSecondary"
      }
      borderRadius="$lg"
      borderWidth={1}
      borderColor={isAggregated ? "$success" : "$border"}
    >
      <XStack justifyContent="space-between" alignItems="flex-start">
        <XStack alignItems="center" gap="$xs">
          {isAggregated && <Sparkles size={16} color="#22C55E" />}
          <Text
            fontSize={12}
            fontWeight="600"
            color={isAggregated ? "$success" : "$textMuted"}
          >
            {isAggregated ? "Aggregated Answer" : "Answer"}
          </Text>
        </XStack>
        <XStack gap="$xs" alignItems="center">
          {hasIndividualResponses && onToggleIndividual && (
            <Button
              size="$2"
              backgroundColor="transparent"
              borderWidth={0}
              color="$textMuted"
              onPress={onToggleIndividual}
              icon={
                showIndividual ? <ChevronUp size={14} /> : <Users size={14} />
              }
            >
              {showIndividual ? "Hide Individual" : "Show Individual"}
            </Button>
          )}
          {hasDetails && (
            <Button
              size="$2"
              backgroundColor="transparent"
              borderWidth={0}
              color="$textMuted"
              onPress={() => setExpanded(!expanded)}
              icon={
                expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              }
            >
              {expanded ? "Less" : "More"}
            </Button>
          )}
        </XStack>
      </XStack>

      <Text
        fontSize={16}
        fontWeight="500"
        color="$color"
        lineHeight={24}
        whiteSpace="pre-wrap"
      >
        {answer}
      </Text>

      {attribution && (
        <Text fontSize={12} color="$textMuted">
          {attribution}
        </Text>
      )}

      {expanded && hasDetails && (
        <YStack gap="$xs" marginTop="$xs">
          {details?.map((detail) => (
            <Text key={detail} fontSize={12} color="$textMuted">
              • {detail}
            </Text>
          ))}
        </YStack>
      )}

      {typeof confidence === "number" && (
        <Text fontSize={12} color="$success">
          Confidence: {Math.round(confidence * 100)}%
        </Text>
      )}

      {/* Individual Responses */}
      {showIndividual && hasIndividualResponses && (
        <YStack gap="$sm" marginTop="$md">
          <Text fontSize={13} fontWeight="600" color="$color">
            Individual Model Responses
          </Text>
          <YStack gap="$sm">
            {baseSolves?.map((solve) => (
              <SolveCard
                key={`${solve.model ?? "model"}-${solve.final}`}
                solve={solve}
                showSteps={showSteps}
                showCitations={showCitations}
              />
            ))}
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

export default function MessageBubble({
  message,
  isUser,
  toolOverride,
  showSteps,
  showCitations,
  globalCollapsed,
}: MessageBubbleProps) {
  const [showIndividualResponses, setShowIndividualResponses] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    name: string;
  } | null>(null);
  const isExpanded = !globalCollapsed;
  const userAttachments = isUser ? (message.attachments ?? []) : [];

  useEffect(() => {
    if (!lightboxImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxImage]);

  // Parse tool outputs from message
  const toolData = useMemo(() => {
    if (isUser) return null;

    const parts = (message as ChatMessage & { parts?: any[] }).parts ?? [];
    const solveQuestions: SolveOutput[] = [
      ...(toolOverride?.solveQuestions ?? []),
    ];
    let subject = toolOverride?.detectSubject;
    const routeModels = [...(toolOverride?.routeModels ?? [])];

    parts.forEach((part) => {
      if (part?.type === "tool-invocation" && part.toolInvocation) {
        const invocation = part.toolInvocation;
        // Safely get output from various invocation states
        const output = (invocation as any).result ?? (invocation as any).output;
        if (!output) return;

        if (invocation.toolName === "detectSubject") {
          subject = output as typeof subject;
        }
        if (invocation.toolName === "routeModel") {
          routeModels.push(output as (typeof routeModels)[0]);
        }
        if (invocation.toolName === "solveQuestion") {
          if (Array.isArray(output)) {
            solveQuestions.push(...output);
          } else if (output.solves) {
            solveQuestions.push(...output.solves);
            if (output.aggregate) solveQuestions.push(output.aggregate);
          } else {
            solveQuestions.push(output);
          }
        }
      }
    });

    return { subject, routeModels, solveQuestions };
  }, [message, toolOverride, isUser]);

  // Assistant message
  const aggregateSolve = toolData?.solveQuestions.find(
    (s) => s.kind === "aggregate"
  );
  const baseSolves =
    toolData?.solveQuestions.filter((s) => s.kind !== "aggregate") ?? [];
  const finalSolve = aggregateSolve ?? baseSolves[baseSolves.length - 1];
  const isAggregated = Boolean(aggregateSolve);

  // Extract final answer text
  const finalAnswer = useMemo(() => {
    if (finalSolve?.final) return finalSolve.final;
    const parts = (message as ChatMessage & { parts?: any[] }).parts ?? [];
    const textParts = parts.filter((p) => p.type === "text");
    return textParts.map((p) => p.text).join("\n") || message.content;
  }, [finalSolve, message]);

  // Build attribution
  const attribution = useMemo(() => {
    if (!toolData) return null;
    const models = [
      ...baseSolves.map((s) => s.model),
      ...toolData.routeModels.map((r) => r.model),
    ].filter(Boolean) as string[];

    if (models.length === 0) return null;
    if (models.length === 1) {
      return isAggregated
        ? `Aggregated by ${finalSolve?.model ?? models[0]}`
        : `Answered by ${models[0]}`;
    }
    return `${models.length} models consulted`;
  }, [toolData, baseSolves, finalSolve, isAggregated]);

  // Build details
  const details = useMemo(() => {
    if (!toolData) return [];
    const lines: string[] = [];

    if (toolData.subject?.subject) {
      const confidence =
        typeof toolData.subject.confidence === "number"
          ? ` (${Math.round(toolData.subject.confidence * 100)}%)`
          : "";
      lines.push(`Subject: ${toolData.subject.subject}${confidence}`);
    }

    const latestRoute = toolData.routeModels[toolData.routeModels.length - 1];
    if (latestRoute?.rationale) {
      lines.push(`Rationale: ${latestRoute.rationale}`);
    }
    if (latestRoute?.mode) {
      lines.push(`Mode: ${latestRoute.mode}`);
    }

    return lines;
  }, [toolData]);

  // User message
  if (isUser) {
    const hasUserText = (message.content ?? "").trim().length > 0;

    return (
      <>
        <XStack justifyContent="flex-end" width="100%">
          <YStack
            maxWidth="85%"
            padding="$md"
            backgroundColor="$color"
            borderRadius="$lg"
            borderBottomRightRadius={4}
          >
            {userAttachments.length > 0 && (
              <XStack
                flexWrap="wrap"
                gap="$xs"
                marginBottom={hasUserText ? "$sm" : 0}
              >
                {userAttachments.map((attachment, index) => (
                  <UserAttachmentPreview
                    key={`${attachment.name}-${index}`}
                    attachment={attachment}
                    onOpenImage={setLightboxImage}
                  />
                ))}
              </XStack>
            )}
            {hasUserText && (
              <Text fontSize={15} color="$background" lineHeight={1.5}>
                {message.content}
              </Text>
            )}
          </YStack>
        </XStack>

        {lightboxImage && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Image preview for ${lightboxImage.name}`}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
            }}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image preview backdrop"
              style={{
                position: "absolute",
                inset: 0,
                border: "none",
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                padding: 0,
                cursor: "zoom-out",
              }}
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image preview"
              style={{
                position: "fixed",
                top: 20,
                right: 20,
                zIndex: 2,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.55)",
                color: "white",
                fontSize: 14,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <div
              style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(92vw, 1200px)",
                height: "min(86vh, 900px)",
                zIndex: 1,
              }}
            >
              <Image
                src={lightboxImage.src}
                alt={lightboxImage.name}
                fill
                unoptimized
                sizes="92vw"
                priority
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <XStack justifyContent="flex-start" width="100%" gap="$sm">
      <YStack
        width={32}
        height={32}
        borderRadius="$full"
        backgroundColor="$backgroundSecondary"
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderColor="$border"
      >
        <Bot size={18} color="var(--colorColor)" />
      </YStack>

      <YStack flex={1} maxWidth="85%" gap="$sm">
        <FinalAnswerCard
          answer={finalAnswer}
          attribution={attribution}
          details={details}
          confidence={finalSolve?.confidence}
          isAggregated={isAggregated}
          baseSolves={baseSolves}
          showSteps={showSteps}
          showCitations={showCitations}
          onToggleIndividual={() =>
            setShowIndividualResponses(!showIndividualResponses)
          }
          showIndividual={showIndividualResponses}
        />

        {/* Legacy: Show individual responses when globally expanded (no aggregate) */}
        {isExpanded && baseSolves.length > 0 && !isAggregated && (
          <YStack gap="$sm">
            <Text fontSize={13} fontWeight="600" color="$color">
              Individual Model Responses
            </Text>
            <YStack gap="$sm">
              {baseSolves.map((solve) => (
                <SolveCard
                  key={`${solve.model ?? "model"}-${solve.final}`}
                  solve={solve}
                  showSteps={showSteps}
                  showCitations={showCitations}
                />
              ))}
            </YStack>
          </YStack>
        )}
      </YStack>
    </XStack>
  );
}
