/* eslint-disable @typescript-eslint/no-require-imports */
// Renders PNG app icons from SVG using the pre-installed Playwright Chromium. Usage: node scripts/render-icons.cjs
const { chromium } = require("playwright");
const path = require("node:path");
const out = path.join(__dirname, "..", "public", "icons");
const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="${pad ? 0 : 18}" fill="#0f0e17"/><g transform="${pad ? "translate(9.6 9.6) scale(0.7)" : ""}"><path d="M18 18 L46 46 M46 18 L18 46" stroke="#f2efe8" stroke-width="7" stroke-linecap="round"/><rect x="10" y="30" width="44" height="4" rx="2" fill="#c8f53a"/></g></svg>`;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, maskable] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-maskable-512.png", 512, true], ["apple-touch-icon.png", 180, true]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${mark(maskable)}</body></html>`);
    await page.screenshot({ path: path.join(out, name), omitBackground: true });
  }
  await browser.close();
  console.log("icons rendered");
})();
