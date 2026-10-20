import { describe, expect, it } from "vitest";

import { activeFps, cutPlan } from "./journey-lib.mjs";

describe("the journey recording's arithmetic", () => {
  it("cuts one clip per beat from the full take, the last one to the end", () => {
    expect(cutPlan([{ name: "create", at: 0.9 }, { name: "pick", at: 7.5 }, { name: "table", at: 16 }, { name: "season", at: 23.2 }], 30)).toEqual([
      { name: "create", from: 0.9, to: 7.5 },
      { name: "pick", from: 7.5, to: 16 },
      { name: "table", from: 16, to: 23.2 },
      { name: "season", from: 23.2, to: 30 },
    ]);
  });
  it("measures the capture rate over the moments the page was moving, not the pauses", () => {
    const frames = [0, 0.033, 0.066, 0.1, 2.5, 2.533, 2.566].map((t) => ({ t }));
    expect(activeFps(frames)).toBeGreaterThan(25);
    expect(activeFps([{ t: 0 }])).toBe(0);
  });
});
