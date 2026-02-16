import { v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { missingEnvVariableUrl } from "./utils";

export const openaiKeySet = query({
  args: {},
  handler: async () => {
    return !!process.env.OR_API_KEY;
  },
});

export const summary = internalAction({
  args: {
    id: v.id("notes"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { id, title, content }) => {
    const prompt = `Take in the following note and return a summary: Title: ${title}, Note content: ${content}`;

    const apiKey = process.env.OR_API_KEY;
    if (!apiKey) {
      const error = missingEnvVariableUrl(
        "OR_API_KEY",
        "https://openrouter.ai/settings/keys"
      );
      console.error(error);
      await ctx.runMutation(internal.openai.saveSummary, {
        id: id,
        summary: error,
      });
      return;
    }
    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "X-Title": "Nexu",
      },
    });
    const output = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant designed to output JSON in this format: {summary: string}",
        },
        { role: "user", content: prompt },
      ],
      model: "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    // Pull the message content out of the response
    const messageContent = output.choices[0]?.message.content;

    if (!messageContent) {
      throw new Error("No content received from OpenRouter");
    }

    const parsedOutput = JSON.parse(messageContent);

    await ctx.runMutation(internal.openai.saveSummary, {
      id: id,
      summary: parsedOutput.summary,
    });
  },
});

export const saveSummary = internalMutation({
  args: {
    id: v.id("notes"),
    summary: v.string(),
  },
  handler: async (ctx, { id, summary }) => {
    await ctx.db.patch(id, {
      summary: summary,
    });
  },
});
