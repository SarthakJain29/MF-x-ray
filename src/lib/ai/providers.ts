/** Server-side LLM providers behind a tiny interface. Keys come from env vars only. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmProvider {
  name: "gemini" | "groq";
  model: string;
  complete(system: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string>;
}

function gemini(key: string, model: string): LlmProvider {
  return {
    name: "gemini",
    model,
    async complete(system, messages, signal) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new Error("Gemini returned no text");
      return text;
    },
  };
}

function groq(key: string, model: string): LlmProvider {
  return {
    name: "groq",
    model,
    async complete(system, messages, signal) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        signal,
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 800, messages: [{ role: "system", content: system }, ...messages] }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("Groq returned no text");
      return text;
    },
  };
}

/** Picks a provider from env: LLM_PROVIDER=gemini|groq, else whichever key is set. Null = mock mode. */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): LlmProvider | null {
  const pref = env.LLM_PROVIDER?.toLowerCase();
  const g = env.GEMINI_API_KEY;
  const q = env.GROQ_API_KEY;
  const gm = env.GEMINI_MODEL || "gemini-2.5-flash";
  const qm = env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (pref === "groq" && q) return groq(q, qm);
  if (pref === "gemini" && g) return gemini(g, gm);
  if (g) return gemini(g, gm);
  if (q) return groq(q, qm);
  return null;
}
