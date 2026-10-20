#!/usr/bin/env node
// One continuous phone take of Kachizaka's journey on a running deployment, as the demo persona Éric (« La gang du vendredi »,
// a named persona, never an admin), captured with the Chrome DevTools screencast (every frame the compositor paints, with its
// timestamp) and encoded at a constant 30 fps: the league and its invite link → a pick before kick-off → the table → the
// results with every friend's pick and the points the sealed rules gave. It writes the full take, one clip per beat (cut from
// the same take, for the landing's StepShowcase), a poster per beat and journey.json (the API calls with their request ids, the
// beats' times and the capture's real frame rate).
//
//   E2E_BASE=https://dev.kachizaka.com E2E_LOCALE=fr E2E_OUT=<dir> E2E_PASSWORD=… node scripts/record-journey.mjs
//
// Needs Chromium for playwright-core and ffmpeg. The password stays in the environment and is never printed. It saves one pick
// for Éric on a game that has not started: demo database only (scripts/seed-league leaves him empty games on purpose).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { activeFps, cutPlan } from "./journey-lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = (process.env.E2E_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "en" ? "en" : "fr";
const OUT = path.resolve(process.env.E2E_OUT ?? "record-out");
const EMAIL = process.env.E2E_EMAIL ?? "eric@personas.kachizaka.test";
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) throw new Error("E2E_PASSWORD is required");

const W = {
  fr: { save: "Enregistrer", saved: "Enregistré", standings: "Classement", results: /La saison, match par match/ },
  en: { save: "Save", saved: "Saved", standings: "Standings", results: /season, match by match/i },
}[LOCALE];

const PHONE = { width: 390, height: 844 };
const SCALE = 2;
const FRAMES = path.join(OUT, `frames-${LOCALE}`);
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

let endAt = 0;
const calls = [];
const beats = [];
const frames = [];
const log = (ok, what) => process.stdout.write(`${ok ? "ok  " : "FAIL"} ${what}\n`);
let t0 = null;
// The screencast sends nothing while the page is still: a beat is placed by the clock (the frames carry epoch seconds), not by the last frame.
const now = () => (t0 === null ? 0 : Date.now() / 1000 - t0);
const mark = (name) => beats.push({ name, at: Number(now().toFixed(3)) });
const hold = (page, ms) => page.waitForTimeout(ms);

/** A smooth scroll: many small steps, so the capture really has motion to show. */
async function glide(page, dy, ms = 1400) {
  await page.evaluate(
    ([distance, duration]) =>
      new Promise((resolve) => {
        const start = performance.now();
        const from = window.scrollY;
        const step = (t) => {
          const k = Math.min(1, (t - start) / duration);
          window.scrollTo(0, from + distance * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2));
          k < 1 ? requestAnimationFrame(step) : resolve();
        };
        requestAnimationFrame(step);
      }),
    [dy, ms],
  );
}

/** Glide until the element sits `offset` px below the top of the screen. */
async function glideTo(page, locator, offset = 90, ms = 1700) {
  const top = await locator.evaluate((el) => el.getBoundingClientRect().top);
  await glide(page, top - offset, ms);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE, locale: LOCALE === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", isMobile: true, hasTouch: true, colorScheme: "dark" });
await context.addInitScript(() => {
  try {
    localStorage.setItem("kz-theme", "dark");
  } catch {}
});
const page = await context.newPage();
page.on("response", (res) => {
  const url = new URL(res.url());
  if (url.pathname.startsWith("/api/")) calls.push({ method: res.request().method(), path: url.pathname.replace(/[0-9a-f-]{36}/g, ":id"), status: res.status(), requestId: res.headers()["x-request-id"] ?? null });
});
page.on("pageerror", (e) => log(false, `no page error (${e.message.slice(0, 120)})`));

const signIn = await context.request.post(`${BASE}/api/auth/sign-in`, { data: { email: EMAIL, password: PASSWORD } });
calls.push({ method: "POST", path: "/api/auth/sign-in", status: signIn.status(), requestId: signIn.headers()["x-request-id"] ?? null });
if (!signIn.ok()) throw new Error(`sign-in refused (${signIn.status()})`);

const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const t = metadata.timestamp;
  if (t0 === null) t0 = t;
  frames.push({ t, data });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

try {
  await page.goto(`${BASE}/${LOCALE}/app`, { waitUntil: "networkidle" });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: PHONE.width * SCALE, maxHeight: PHONE.height * SCALE, everyNthFrame: 1 });
  await hold(page, 900);
  // 1 — the league, its figures and its invite link.
  await page.locator("main a[href*='/app/leagues/']:not([href$='/new'])").first().click();
  await page.locator("main h1").waitFor();
  await page.waitForLoadState("networkidle");
  mark("create");
  await hold(page, 1800);
  await glide(page, 360, 1700);
  await hold(page, 2000);

  // 2 — a pick before kick-off, on a game Éric has not picked yet.
  const save = page.locator("main form button[type=submit]").filter({ hasText: new RegExp(`^${W.save}$`) }).first();
  await save.waitFor({ state: "attached" });
  const form = save.locator("xpath=ancestor::form");
  await form.evaluate((f) => {
    const d = f.closest("details");
    if (d) d.open = true;
  });
  await form.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  mark("pick");
  await hold(page, 1100);
  const goals = form.locator("input[inputmode=numeric]");
  await goals.nth(0).pressSequentially("3", { delay: 220 });
  await hold(page, 450);
  await goals.nth(1).pressSequentially("2", { delay: 220 });
  await hold(page, 600);
  const overtime = form.getByRole("checkbox");
  if (await overtime.count()) await overtime.check();
  await hold(page, 800);
  await save.click();
  await page.getByText(W.saved, { exact: true }).first().waitFor();
  log(true, "a pick saved before kick-off");
  await hold(page, 2200);

  // 3 — the table, recomputed whole and live.
  mark("table");
  await glideTo(page, page.getByRole("heading", { name: W.standings }).first(), 90, 1900);
  await hold(page, 3200);

  // 4 — the results: every friend's pick, the points, the rule that earned them.
  mark("season");
  await glideTo(page, page.getByRole("heading", { name: W.results }).first(), 90, 2200);
  await hold(page, 1800);
  await glide(page, 520, 1900);
  await hold(page, 1800);
  await glide(page, 520, 1900);
  await hold(page, 2200);
  mark("end");
} finally {
  endAt = now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  await browser.close();
}

// Encode: each frame is held until the next one (the screencast only sends what changed), then a constant 30 fps.
const duration = Math.max(endAt, frames.at(-1).t - t0);
let list = "";
frames.forEach((f, i) => {
  const file = path.join(FRAMES, `${String(i).padStart(5, "0")}.jpg`);
  writeFileSync(file, Buffer.from(f.data, "base64"));
  const next = frames[i + 1]?.t ?? t0 + duration; // the last frame is held to the end of the take
  list += `file '${file}'\nduration ${Math.max(next - f.t, 1 / 120).toFixed(5)}\n`;
});
list += `file '${path.join(FRAMES, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'\n`;
writeFileSync(path.join(FRAMES, "list.txt"), list);
const full = path.join(OUT, `take-${LOCALE}.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(FRAMES, "list.txt"), "-vf", "fps=30,scale=780:-2:flags=lanczos", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", full]);

// One clip (mp4 + webm) and one poster per beat, cut from the same take.
const steps = beats.filter((b) => b.name !== "end");
const plan = cutPlan(beats, duration).filter((c) => c.name !== "end");
for (const c of plan) {
  const base = ["-y", "-loglevel", "error", "-ss", String(c.from), "-i", full, "-t", String(Math.max(c.to - c.from, 0.5)), "-an"];
  execFileSync("ffmpeg", [...base, "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, `${c.name}-${LOCALE}.mp4`)]);
  execFileSync("ffmpeg", [...base, "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", path.join(OUT, `${c.name}-${LOCALE}.webm`)]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(c.to - 0.5, c.from)), "-i", full, "-frames:v", "1", "-q:v", "3", path.join(OUT, `phone-${c.name}-${LOCALE}.jpg`)]);
}

const fps = activeFps(frames);
const meta = { base: BASE, locale: LOCALE, viewport: PHONE, scale: SCALE, durationSeconds: Number(duration.toFixed(2)), frames: frames.length, activeCaptureFps: Number(fps.toFixed(1)), outputFps: 30, beats, steps: steps.map((s) => s.name), calls };
writeFileSync(path.join(OUT, `journey-${LOCALE}.json`), JSON.stringify(meta, null, 2));
log(fps >= 25, `capture rate while moving: ${fps.toFixed(1)} fps (${frames.length} frames over ${duration.toFixed(1)} s)`);
log(calls.every((c) => c.status < 500), "no API call answered with a server error");
log(duration >= 25 && duration <= 40, `the take lasts ${duration.toFixed(1)} s`);
process.stdout.write(`take: ${full}\nbeats: ${beats.map((b) => `${b.name}@${b.at}`).join(" ")}\n`);
