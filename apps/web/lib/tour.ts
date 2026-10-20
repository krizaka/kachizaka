/**
 * The landing's living proof: Éric's real journey in « La gang du vendredi » on dev.kachizaka.com (a named persona of the
 * demonstration league — never an admin, never a real person), captured on a phone (390 × 844, 2×, dark) on 2026-10-19 by
 * `scripts/record-journey.mjs` — the Chrome DevTools screencast, 57 frames a second while the page moved, encoded at 30 fps; its
 * API calls with their request ids are in docs/journey-2026-10-19.json. The stills are the posters (shown first, and the only
 * picture under reduced motion); the 31 s take is cut into one clip per step, played by StepShowcase once the block is seen. On
 * the Krizaka media CDN under hashed, immutable names (`site/products/kachizaka/tour/…`, a prefix owned by this site: a new
 * capture is new hashes here and the old files pruned by hand).
 */
/** The Krizaka media CDN — the one host the page's CSP lets serve images and videos (next.config.mjs). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

export const TOUR_STEPS = ["create", "pick", "table", "season"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

const STILLS: Record<TourStep, string> = { create: "bcb62562a5", pick: "f6e9a71990", table: "4d1eab4436", season: "734a9710d6" };
const CLIPS: Record<TourStep, { mp4: string; webm: string }> = {
  create: { mp4: "84f19a91be", webm: "242d18d415" },
  pick: { mp4: "3e6d11f000", webm: "7d1b9c66a3" },
  table: { mp4: "1b250da14d", webm: "31d54d469f" },
  season: { mp4: "ee55b86d23", webm: "9a0189561f" },
};
/** The whole take, in one piece: the evidence of `journey.core` in dev-preview.json. */
export const TAKE = { mp4: `${MEDIA_CDN}/site/products/kachizaka/tour/journey.a9bda06b7f.mp4`, capturedOn: "2026-10-19" } as const;

const dir = `${MEDIA_CDN}/site/products/kachizaka/tour`;
export const tourStill = (step: TourStep) => `${dir}/phone-${step}.${STILLS[step]}.jpg`;
/** The step's recording, cut from the take (muted): WebM first, MP4 for Safari. */
export const tourClip = (step: TourStep) => ({ webm: `${dir}/${step}.${CLIPS[step].webm}.webm`, mp4: `${dir}/${step}.${CLIPS[step].mp4}.mp4` });
