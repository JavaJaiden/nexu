import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const orOpenAI = createOpenAI({
  apiKey: process.env.OR_API_KEY,
  baseURL: process.env.OR_BASE_URL ?? OPENROUTER_BASE_URL,
  compatibility: "compatible",
  name: "openrouter",
});
