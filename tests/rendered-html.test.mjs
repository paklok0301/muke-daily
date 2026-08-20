import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Muke mobile app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-HK">/);
  assert.match(html, /<title>暮刻 — 你的日常與工時<\/title>/);
  assert.match(html, /開始工作/);
  assert.match(html, /Remember.*who you are\./s);
  assert.match(html, /跆拳道/);
  assert.doesNotMatch(html, /咖啡店/);
  assert.match(html, /今天練哪裡/);
  assert.match(html, /胸<\/button>.*背<\/button>.*肩<\/button>.*腿<\/button>/s);
  assert.match(html, /aria-label="生活月曆"/);
  assert.match(html, /aria-label="月曆檢視"/);
  assert.match(html, />月<\/button>.*>週<\/button>.*>日<\/button>/s);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("ships installable app assets and local persistence", async () => {
  const [page, manifest, serviceWorker, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /serviceWorker\.register/);
  assert.match(page, /workouts:\s*Record<string, WorkoutType>/);
  assert.doesNotMatch(page, /setDiaryText\(data\.diary\[isoDate\(\)\]/);
  assert.match(page, /工時需要大於 0 分鐘/);
  assert.match(page, /startViewTransition/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(serviceWorker, /caches\.open/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await Promise.all([
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);
});
