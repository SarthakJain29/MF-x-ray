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

/**
 * Providers configured via env, in preference order (LLM_PROVIDER first, then whichever keys exist).
 * The chat route tries them in order, so a quota error on one falls through to the next. Empty = mock mode.
 */
export function providersFromEnv(env: Record<string, string | undefined> = process.env): LlmProvider[] {
  const g = env.GEMINI_API_KEY;
  const q = env.GROQ_API_KEY;
  const gm = env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const qm = env.GROQ_MODEL || "openai/gpt-oss-120b";
  const list: LlmProvider[] = [];
  if (g) list.push(gemini(g, gm));
  if (q) list.push(groq(q, qm));
  const pref = env.LLM_PROVIDER?.toLowerCase();
  if (pref) list.sort((a, b) => (a.name === pref ? -1 : b.name === pref ? 1 : 0));
  return list;
}

export function providerFromEnv(env: Record<string, string | undefined> = process.env): LlmProvider | null {
  return providersFromEnv(env)[0] ?? null;
}
