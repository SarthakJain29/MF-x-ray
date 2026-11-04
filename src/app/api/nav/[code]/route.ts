/**
 * Fallback proxy for public NAV history (mfapi.in) when the browser can't fetch it directly
 * (mfapi occasionally serves cached responses without CORS headers).
 * Receives only a public AMFI scheme code. Stateless: nothing is logged or stored.
 */
export const revalidate = 21600; // cache upstream responses for 6h

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^\d{3,7}$/.test(code)) return Response.json({ error: "invalid scheme code" }, { status: 400 });
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${code}`, { next: { revalidate } });
    if (!res.ok) return Response.json({ error: `upstream ${res.status}` }, { status: 502 });
    const body = await res.text();
    return new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=21600" } });
  } catch {
    return Response.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
