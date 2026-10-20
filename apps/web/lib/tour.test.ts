import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { STORY_STEPS } from "./landing";
import { MEDIA_CDN, TAKE, TOUR_STEPS, tourClip, tourStill } from "./tour";

const ROOT = join(__dirname, "..", "..", "..");

describe("the landing's recorded journey", () => {
  it("has one clip and one still per step of the story, on the media CDN under hashed names", () => {
    expect([...TOUR_STEPS]).toEqual([...STORY_STEPS]);
    for (const step of TOUR_STEPS) {
      expect(tourStill(step).startsWith(`${MEDIA_CDN}/site/products/kachizaka/tour/phone-${step}.`)).toBe(true);
      expect(tourStill(step)).toMatch(/\.[0-9a-f]{10}\.jpg$/);
      const clip = tourClip(step);
      expect(clip.webm).toMatch(/\.[0-9a-f]{10}\.webm$/);
      expect(clip.mp4).toMatch(/\.[0-9a-f]{10}\.mp4$/);
    }
    expect(TAKE.mp4).toMatch(/\/journey\.[0-9a-f]{10}\.mp4$/);
  });

  it("is the evidence of journey.core in the dev-preview checklist, with the request ids of the run kept in docs/", () => {
    const preview = JSON.parse(readFileSync(join(ROOT, "dev-preview.json"), "utf8")) as { criteria: Record<string, { evidence: string | null }> };
    expect(preview.criteria["journey.core"]!.evidence).toBe(TAKE.mp4);
    const run = JSON.parse(readFileSync(join(ROOT, "docs/journey-2026-10-19.json"), "utf8")) as { activeCaptureFps: number; calls: { requestId: string | null; status: number }[]; durationSeconds: number };
    expect(run.activeCaptureFps).toBeGreaterThanOrEqual(25);
    expect(run.durationSeconds).toBeGreaterThanOrEqual(25);
    expect(run.calls.some((c) => c.requestId)).toBe(true);
    expect(run.calls.every((c) => c.status < 500)).toBe(true);
  });

  it("has its words, with what each still shows, in both languages", () => {
    for (const m of [en, fr]) {
      const t = m.landing.tour;
      for (const k of ["label", "play", "pause", "step", "captured"] as const) expect(t[k].length).toBeGreaterThan(0);
      for (const step of TOUR_STEPS) expect(t.steps[step].alt.length).toBeGreaterThan(10);
    }
    expect(fr.landing.tour.captured).toContain("dev.kachizaka.com");
  });
});
