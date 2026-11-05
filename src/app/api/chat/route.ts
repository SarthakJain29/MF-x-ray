/**
 * AI chat proxy. Receives ONLY the anonymised AiContext + question, forwards to Gemini/Groq, returns text.
 * Stateless: no logging, no storage. With no API key configured, returns 503 and the client answers locally.
 */
import { containsPII, scrubText, type AiContext } from "@/lib/ai/anonymize";
import { SYSTEM_PROMPT, userPrompt } from "@/lib/ai/prompt";
import { providersFromEnv, type ChatMessage } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

interface Body {
  question?: string;
  context?: AiContext;
  history?: ChatMessage[];
}

export async function GET() {
  const list = providersFromEnv();
  return Response.json({ mode: list.length ? "ai" : "local", providers: list.map((p) => p.name) });
}

export async function POST(req: Request) {
  const providers = providersFromEnv();
  if (!providers.length) return Response.json({ error: "no-provider" }, { status: 503 });

  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > 60_000) return Response.json({ error: "too-large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad-json" }, { status: 400 });
  }
  const question = scrubText(String(body.question ?? "")).trim();
  if (!question || !body.context) return Response.json({ error: "missing-fields" }, { status: 400 });
  const ctxJson = JSON.stringify(body.context);
  // Defence in depth: refuse anything that still looks like it carries identifiers.
  if (containsPII(ctxJson)) return Response.json({ error: "pii-detected" }, { status: 400 });

  const history = (body.history ?? [])
    .slice(-6)
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: scrubText(String(m.content)).slice(0, 1500) }));

  const messages = [...history, { role: "user" as const, content: userPrompt(question, body.context) }];
  for (const provider of providers) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const answer = await provider.complete(SYSTEM_PROMPT, messages, ctrl.signal);
      return Response.json({ answer, provider: provider.name });
    } catch {
      // try the next provider
    } finally {
      clearTimeout(timer);
    }
  }
  return Response.json({ error: "provider-failed" }, { status: 502 });
}
