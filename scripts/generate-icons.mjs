// アプリアイコン(PNG)を SVG から作り直すスクリプト。
//   node scripts/generate-icons.mjs
// Playwright(Chromium)が必要です。生成物は public/icons と src/app/apple-icon.png。
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { writeFile } from "node:fs/promises";

const pin = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 92c-70 0-124 54-124 122 0 92 124 206 124 206s124-114 124-206c0-68-54-122-124-122z" fill="#ffffff"/>
    <path d="M256 250l-34-33a24 24 0 0 1 34-34 24 24 0 0 1 34 34z" fill="#c8524c"/>
  </g>`;

const svg = ({ rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#c8524c"/>
  ${pin(scale)}
</svg>`;

const targets = [
  { file: "public/icons/icon-192.png", size: 192, rounded: true, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, rounded: true, scale: 1 },
  { file: "public/icons/icon-maskable-512.png", size: 512, rounded: false, scale: 0.78 },
  { file: "src/app/apple-icon.png", size: 180, rounded: false, scale: 0.9 },
  { file: "src/app/icon.png", size: 64, rounded: true, scale: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(t).replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)}</body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(t.file, buf);
  console.log("wrote", t.file);
}
await browser.close();
