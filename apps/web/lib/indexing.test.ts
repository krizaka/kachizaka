import { describe, expect, it } from "vitest";

import { closedRobots, indexable, NOINDEX } from "./indexing";

describe("APP_SEARCH_INDEXING", () => {
  it("is open by default and closed only by an exact off", () => {
    expect(indexable({})).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "on" })).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "off" })).toBe(false);
    expect(indexable({ APP_SEARCH_INDEXING: " OFF " })).toBe(false);
  });

  it("closes robots.txt to everyone, and still names the sitemap (the family's contract: a noindex site serves the same files)", () => {
    const robots = closedRobots("https://dev.kachizaka.com");
    expect(robots).toContain("Disallow: /");
    expect(robots).toContain("Sitemap: https://dev.kachizaka.com/sitemap.xml");
    expect(NOINDEX).toBe("noindex, nofollow");
  });
});
