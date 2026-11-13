// Agent settings: runs the model through OpenRouter, using OPENROUTER_API_KEY from .env.local.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  includeUsage: true,
});

export default defineAgent({
  // pg has optional native bindings (pg-native), so keep it out of the bundle.
  build: { externalDependencies: ["pg"] },
  limits: {
    maxInputTokensPerSession: 5_000_000,
    maxOutputTokensPerSession: 100_000,
  },
  model: openrouter("qwen/qwen3.6-flash"),
  // Context window of the model, in tokens. Check the model's page on OpenRouter and adjust if needed.
  modelContextWindowTokens: 128_000,
  reasoning: "medium",
});