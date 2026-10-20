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

const STILLS: Record<TourStep, string> = { create: "58cb9214b9", pick: "ba2a2d7f41", table: "6de6430394", season: "ef1593666a" };
const CLIPS: Record<TourStep, { mp4: string; webm: string }> = {
  create: { mp4: "07255696b3", webm: "f7728d77ee" },
  pick: { mp4: "8d331b5d18", webm: "1ba16cebab" },
  table: { mp4: "d5c0168dcc", webm: "2df90aad2c" },
  season: { mp4: "4d0e30f2f3", webm: "5d54913341" },
};
/** The whole take, in one piece: the evidence of `journey.core` in dev-preview.json. */
export const TAKE = { mp4: `${MEDIA_CDN}/site/products/kachizaka/tour/journey.a7a2e8a2f4.mp4`, capturedOn: "2026-10-19" } as const;

const dir = `${MEDIA_CDN}/site/products/kachizaka/tour`;
export const tourStill = (step: TourStep) => `${dir}/phone-${step}.${STILLS[step]}.jpg`;
/** The step's recording, cut from the take (muted): WebM first, MP4 for Safari. */
export const tourClip = (step: TourStep) => ({ webm: `${dir}/${step}.${CLIPS[step].webm}.webm`, mp4: `${dir}/${step}.${CLIPS[step].mp4}.mp4` });
