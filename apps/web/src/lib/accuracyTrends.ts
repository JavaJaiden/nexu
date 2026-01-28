import type { HistoryEntry } from "@/lib/historyStore";

type TrendBucket = {
  total: number;
  count: number;
  recentTotal: number;
  recentCount: number;
  prevTotal: number;
  prevCount: number;
};

export type AccuracyTrend = {
  subject: string;
  average: number;
  delta: number | null;
  count: number;
};

function extractEntryConfidence(entry: HistoryEntry) {
  const confidences: number[] = [];
  for (const message of entry.transcript ?? []) {
    if (!message || typeof message !== "object" || !("role" in message)) continue;
    const solves = message.tools?.solveQuestions ?? [];
    for (const solve of solves) {
      if (typeof solve.confidence === "number") {
        confidences.push(solve.confidence);
      }
    }
  }
  if (confidences.length === 0) return null;
  const sum = confidences.reduce((acc, value) => acc + value, 0);
  return sum / confidences.length;
}

export function computeAccuracyTrends(entries: HistoryEntry[]) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentCutoff = now - 7 * dayMs;
  const prevCutoff = now - 14 * dayMs;
  const buckets = new Map<string, TrendBucket>();

  for (const entry of entries) {
    if (!entry.subject || entry.subject === "Model Hub Compare") continue;
    const confidence = extractEntryConfidence(entry);
    if (confidence === null) continue;
    const bucket = buckets.get(entry.subject) ?? {
      total: 0,
      count: 0,
      recentTotal: 0,
      recentCount: 0,
      prevTotal: 0,
      prevCount: 0,
    };

    bucket.total += confidence;
    bucket.count += 1;

    const createdAt = new Date(entry.createdAt).getTime();
    if (!Number.isNaN(createdAt)) {
      if (createdAt >= recentCutoff) {
        bucket.recentTotal += confidence;
        bucket.recentCount += 1;
      } else if (createdAt >= prevCutoff && createdAt < recentCutoff) {
        bucket.prevTotal += confidence;
        bucket.prevCount += 1;
      }
    }

    buckets.set(entry.subject, bucket);
  }

  return Array.from(buckets.entries())
    .map(([subject, bucket]) => {
      const average = bucket.count ? bucket.total / bucket.count : 0;
      const recentAvg = bucket.recentCount ? bucket.recentTotal / bucket.recentCount : null;
      const prevAvg = bucket.prevCount ? bucket.prevTotal / bucket.prevCount : null;
      const delta =
        recentAvg !== null && prevAvg !== null ? recentAvg - prevAvg : null;
      return {
        subject,
        average,
        delta,
        count: bucket.count,
      };
    })
    .sort((a, b) => b.count - a.count);
}
