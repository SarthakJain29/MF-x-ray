import { describe, expect, it } from "vitest";
import { providersFromEnv } from "@/lib/ai/providers";

describe("LLM provider selection", () => {
  it("is empty (mock mode) without keys", () => {
    expect(providersFromEnv({})).toEqual([]);
  });
  it("orders by LLM_PROVIDER and falls back to the other", () => {
    expect(providersFromEnv({ GEMINI_API_KEY: "x", GROQ_API_KEY: "y" }).map((p) => p.name)).toEqual(["gemini", "groq"]);
    expect(providersFromEnv({ GEMINI_API_KEY: "x", GROQ_API_KEY: "y", LLM_PROVIDER: "groq" }).map((p) => p.name)).toEqual(["groq", "gemini"]);
    expect(providersFromEnv({ GROQ_API_KEY: "y", GROQ_MODEL: "m" })[0]).toMatchObject({ name: "groq", model: "m" });
  });
});
