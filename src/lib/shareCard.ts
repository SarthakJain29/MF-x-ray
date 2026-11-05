/**
 * Shareable "portfolio X-ray" card. Data is percentages only (amounts only if the user opts in) and never
 * includes name, PAN, folio, e-mail or ISINs. Drawn on a canvas entirely in the browser.
 */
import type { Portfolio } from "./finance/portfolio";
import type { OverlapReport } from "./overlap";
import { fmtYearMonth, inrShort } from "./format";

export interface ShareCardData {
  title: string;
  allocation: { key: string; share: number }[];
  topStocks: { name: string; share: number }[];
  overlap: { a: string; b: string; pct: number } | null;
  stats: { label: string; value: string }[];
  funds: number;
  dataMonth: string | null;
}

export interface ShareOptions {
  showAmounts: boolean;
  showXirr: boolean;
}

export function shareCardData(p: Portfolio, o: OverlapReport | null, opt: ShareOptions): ShareCardData {
  const name = (id: string) => p.holdings.find((h) => h.id === id)?.shortName ?? "";
  const stats: ShareCardData["stats"] = [];
  if (opt.showAmounts) stats.push({ label: "Value", value: inrShort(p.value) });
  if (opt.showXirr && p.xirr != null) stats.push({ label: "XIRR so far", value: `${(p.xirr * 100).toFixed(1)}%` });
  if (p.weightedTer != null) stats.push({ label: "Avg expense ratio", value: `${p.weightedTer.toFixed(2)}%` });
  const direct = p.allocation.plan.find((x) => x.key === "Direct")?.share ?? 0;
  stats.push({ label: "In direct plans", value: `${Math.round(direct * 100)}%` });
  if (o && o.top10Share) stats.push({ label: "Top 10 stocks", value: `${Math.round(o.top10Share * 100)}%` });
  const top = o?.pairs[0];
  return {
    title: "My portfolio X-ray",
    allocation: p.allocation.assetClass.map((s) => ({ key: s.key, share: s.share })),
    topStocks: (o?.exposure ?? []).slice(0, 4).map((e) => ({ name: e.name, share: e.shareOfEquity })),
    overlap: top ? { a: name(top.a), b: name(top.b), pct: Math.round(top.overlap) } : null,
    stats: stats.slice(0, 4),
    funds: p.holdings.length,
    dataMonth: o?.dataMonth ? fmtYearMonth(o.dataMonth) : null,
  };
}

const COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#8d899a"];

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

/** Draw the 1080×1350 card. `fonts` are CSS font-family strings (display, body). */
export function drawShareCard(ctx: CanvasRenderingContext2D, d: ShareCardData, fonts: { display: string; body: string }) {
  const W = 1080;
  const H = 1350;
  const P = 80;
  ctx.fillStyle = "#0f0e17";
  ctx.fillRect(0, 0, W, H);
  // glow + grid
  const g1 = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, 700);
  g1.addColorStop(0, "rgba(200,245,58,0.28)");
  g1.addColorStop(1, "rgba(200,245,58,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(0, H, 0, 0, H, 800);
  g2.addColorStop(0, "rgba(91,61,245,0.45)");
  g2.addColorStop(1, "rgba(91,61,245,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // logo
  ctx.fillStyle = "#c8f53a";
  ctx.fillRect(P, P + 22, 56, 8);
  ctx.strokeStyle = "#f2efe8";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(P + 8, P);
  ctx.lineTo(P + 48, P + 52);
  ctx.moveTo(P + 48, P);
  ctx.lineTo(P + 8, P + 52);
  ctx.stroke();
  ctx.fillStyle = "#f2efe8";
  ctx.font = `800 40px ${fonts.display}`;
  ctx.fillText("MF X-ray", P + 76, P + 40);

  ctx.font = `800 84px ${fonts.display}`;
  ctx.fillText(d.title, P, 270);
  ctx.font = `400 30px ${fonts.body}`;
  ctx.fillStyle = "rgba(242,239,232,0.65)";
  ctx.fillText(`${d.funds} funds · ${d.dataMonth ? `holdings as of ${d.dataMonth}` : "allocation"}`, P, 320);

  // allocation bar
  let y = 390;
  ctx.fillStyle = "rgba(242,239,232,0.6)";
  ctx.font = `600 26px ${fonts.body}`;
  ctx.fillText("WHERE THE MONEY SITS", P, y);
  y += 30;
  let x = P;
  const bw = W - 2 * P;
  d.allocation.forEach((s, i) => {
    const w = Math.max(4, bw * s.share);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(x, y, w - 4, 44);
    x += w;
  });
  y += 84;
  ctx.font = `500 28px ${fonts.body}`;
  x = P;
  d.allocation.slice(0, 4).forEach((s, i) => {
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(x, y - 20, 20, 20);
    ctx.fillStyle = "#f2efe8";
    const label = `${s.key} ${Math.round(s.share * 100)}%`;
    ctx.fillText(label, x + 30, y);
    x += ctx.measureText(label).width + 70;
  });

  // overlap hero
  y += 80;
  if (d.overlap) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(P, y, bw, 200, 36);
    ctx.fill();
    ctx.fillStyle = "#c8f53a";
    ctx.font = `800 120px ${fonts.display}`;
    ctx.fillText(`${d.overlap.pct}%`, P + 40, y + 140);
    const nx = P + 40 + ctx.measureText(`${d.overlap.pct}%`).width + 30;
    ctx.fillStyle = "#f2efe8";
    ctx.font = `700 34px ${fonts.display}`;
    ctx.fillText("the same", nx, y + 90);
    ctx.font = `400 28px ${fonts.body}`;
    ctx.fillStyle = "rgba(242,239,232,0.75)";
    ctx.fillText(wrap(ctx, d.overlap.a, W - P - 40 - nx), nx, y + 135);
    ctx.fillText(wrap(ctx, `∩ ${d.overlap.b}`, W - P - 40 - nx), nx, y + 175);
    y += 260;
  }

  // top stocks
  ctx.fillStyle = "rgba(242,239,232,0.6)";
  ctx.font = `600 26px ${fonts.body}`;
  ctx.fillText("MY REAL TOP STOCKS (ACROSS ALL FUNDS)", P, y);
  y += 24;
  const maxS = d.topStocks[0]?.share || 1;
  for (const s of d.topStocks) {
    y += 52;
    ctx.fillStyle = "#f2efe8";
    ctx.font = `500 30px ${fonts.body}`;
    ctx.fillText(wrap(ctx, s.name, 420), P, y);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(P + 450, y - 22, bw - 450 - 120, 18);
    ctx.fillStyle = "#3987e5";
    ctx.fillRect(P + 450, y - 22, (bw - 450 - 120) * (s.share / maxS), 18);
    ctx.fillStyle = "#f2efe8";
    ctx.textAlign = "right";
    ctx.fillText(`${(s.share * 100).toFixed(1)}%`, W - P, y);
    ctx.textAlign = "left";
  }

  // stats row (flows after the list, never overlapping it)
  y = Math.max(y + 110, H - 250);
  const cw = bw / Math.max(1, d.stats.length);
  d.stats.forEach((s, i) => {
    ctx.fillStyle = "rgba(242,239,232,0.6)";
    ctx.font = `500 22px ${fonts.body}`;
    ctx.fillText(wrap(ctx, s.label, cw - 16), P + i * cw, y);
    ctx.fillStyle = "#f2efe8";
    ctx.font = `800 44px ${fonts.display}`;
    ctx.fillText(wrap(ctx, s.value, cw - 20), P + i * cw, y + 54);
  });

  ctx.fillStyle = "rgba(242,239,232,0.45)";
  ctx.font = `400 22px ${fonts.body}`;
  ctx.fillText("Analysed privately on-device with MF X-ray · educational, not investment advice", P, H - 56);
}
