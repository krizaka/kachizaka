import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";

const get = (path: string) => proxy(new NextRequest(`https://dev.kachizaka.com${path}`, { headers: { host: "dev.kachizaka.com" } }));

afterEach(() => vi.unstubAllEnvs());

describe("the proxy of a deployment closed to search engines (APP_SEARCH_INDEXING=off)", () => {
  it("noindexes every page, closes robots.txt (naming the sitemap) and still serves the sitemap, noindex", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    expect(get("/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = get("/robots.txt");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://dev.kachizaka.com/sitemap.xml\n");
    const sitemap = get("/sitemap.xml");
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(sitemap.status).toBe(200);
  });

  it("leaves an open deployment alone", () => {
    expect(get("/en").headers.get("x-robots-tag")).toBeNull();
    expect(get("/sitemap.xml").status).toBe(200);
  });
});
