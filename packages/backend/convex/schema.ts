import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
  }),
  leaderboardModels: defineTable({
    id: v.string(),
    source: v.literal("openrouter"),
    modelId: v.string(),
    name: v.string(),
    provider: v.string(),
    description: v.optional(v.string()),
    contextLength: v.optional(v.number()),
    pricing: v.optional(
      v.object({
        prompt: v.optional(v.number()),
        completion: v.optional(v.number()),
      })
    ),
    capabilities: v.array(v.string()),
    availability: v.optional(
      v.union(v.literal("available"), v.literal("unknown"))
    ),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_modelId", ["modelId"])
    .index("by_provider", ["provider"])
    .index("by_name", ["name"]),
  leaderboardIngestState: defineTable({
    key: v.literal("openrouter"),
    lastRunAt: v.number(),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_key", ["key"]),
});
