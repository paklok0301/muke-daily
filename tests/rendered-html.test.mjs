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
  assert.doesNotMatch(html, /Part-time|開始工作/);
  assert.match(html, /Remember.*who you are\./s);
  assert.doesNotMatch(html, /咖啡店/);
  assert.match(html, /今天練哪裡/);
  assert.match(html, /胸<\/button>.*背<\/button>.*肩<\/button>.*腿<\/button>/s);
  assert.match(html, /aria-label="生活月曆"/);
  assert.match(html, /aria-label="月曆檢視"/);
  assert.match(html, />月<\/button>.*>週<\/button>.*>日<\/button>/s);
  assert.match(html, />今天<\/button>.*>新增活動<\/button>.*>校園<\/button>.*>公事<\/button>/s);
  assert.doesNotMatch(html, />日記<\/button>/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("ships installable app assets and local persistence", async () => {
  const [page, manifest, serviceWorker, packageJson, holidayRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hk-holidays/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /localStorage\.setItem/);
  assert.doesNotMatch(page, /開始工作|Quick clock|toggleClock|useClock/);
  assert.match(page, /跆拳道/);
  assert.match(page, /serviceWorker\.register/);
  assert.match(page, /下載備份/);
  assert.match(page, /匯入備份/);
  assert.match(page, /暮刻備份-/);
  assert.match(page, /workouts:\s*Record<string, WorkoutType>/);
  assert.match(page, /type Tab = "home" \| "activity" \| "campus" \| "work"/);
  assert.doesNotMatch(page, /tab === "diary"|儲存日記|今日日記/);
  assert.match(page, /tab === "activity"/);
  assert.match(page, /tab === "campus"/);
  assert.doesNotMatch(page, /暮刻 · TODAY|暮刻 · 現在|<span>暮<\/span>/);
  assert.match(page, /行程提醒 · 現在/);
  assert.match(page, /todayLockscreenItems/);
  assert.match(page, /todayPlans\.map/);
  assert.match(page, /黑色每日總覽會列出全部活動、課堂、功課與待辦/);
  assert.match(page, /preview-widget-item/);
  assert.match(page, /preview-task-item/);
  assert.doesNotMatch(page, /todayLockscreenItems\.slice/);
  assert.match(page, /工時需要大於 0 分鐘/);
  assert.match(page, /startViewTransition/);
  assert.match(page, /planColors = \[/);
  assert.match(page, /showNotification\(`🗓️ 明日行程/);
  assert.match(page, /功課死線提醒/);
  assert.match(page, /text\/calendar/);
  assert.match(page, /type RecurringClass/);
  assert.match(page, /type Assignment/);
  assert.match(page, /function classOccursOn/);
  assert.match(page, /每週課表/);
  assert.match(page, /功課死線/);
  assert.match(page, /下載鎖屏行事曆/);
  assert.match(page, /RRULE:FREQ=WEEKLY/);
  assert.match(page, /TRIGGER:-P1D/);
  assert.match(page, /TRIGGER:-P7D/);
  assert.match(page, /agenda:\$\{tomorrowKey\}/);
  assert.match(page, /emojiOptions/);
  assert.match(page, /堂數／節數/);
  assert.match(page, /實收金額 HK\$/);
  assert.match(page, /shiftEarnings\(shift, job\)/);
  assert.match(page, /shiftLocation\.trim\(\)/);
  assert.match(page, /所選月份工作結算/);
  assert.match(page, /sessions \+= shift\.sessions/);
  assert.match(page, /function deleteJob/);
  assert.match(page, /function deleteShift/);
  assert.match(page, /function startEditShift/);
  assert.match(page, /function clearCompletedTasks/);
  assert.match(page, /navigator\.storage\.persist/);
  assert.match(page, /setAppBadge/);
  assert.match(page, /這段工時似乎已經記錄過/);
  assert.match(page, /今天摘要/);
  assert.match(page, /workMonth/);
  assert.match(page, /刪除\$\{shift\.date\}工時記錄/);
  assert.match(page, /至少需要保留一個工作/);
  assert.match(page, /過往工時記錄會保留/);
  assert.match(page, /new URL\("api\/hk-holidays", document\.baseURI\)/);
  assert.match(page, /new URL\("hk-holidays\.json", document\.baseURI\)/);
  assert.match(page, /setView\("day"\)/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /purpose:\s*"maskable"/);
  assert.match(serviceWorker, /caches\.open/);
  assert.match(serviceWorker, /notificationclick/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(holidayRoute, /1823\.gov\.hk\/common\/ical\/tc\.ics/);
  assert.match(holidayRoute, /DTSTART;VALUE=DATE/);
  await Promise.all([
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);
});
