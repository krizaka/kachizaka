import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../proxy";

const get = (path: string) => proxy(new NextRequest(`https://dev.kachizaka.com${path}`, { headers: { host: "dev.kachizaka.com" } }));

afterEach(() => vi.unstubAllEnvs());

describe("the proxy of a deployment closed to search engines (APP_SEARCH_INDEXING=off)", () => {
  it("noindexes every page, closes robots.txt (naming the sitemap) and still serves the sitemap, noindex", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    expect(get("/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = get("/robots.txt");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://www.kachizaka.com/sitemap.xml\n");
    const sitemap = get("/sitemap.xml");
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(sitemap.status).toBe(200);
  });

  it("leaves an open deployment alone", () => {
    expect(get("/en").headers.get("x-robots-tag")).toBeNull();
    expect(get("/sitemap.xml").status).toBe(200);
  });
});

const as = (host: string, path: string, init: { method?: string } = {}) => proxy(new NextRequest(`https://${host}${path}`, { method: init.method, headers: { host } }));

describe("www.kachizaka.com is public, dev.kachizaka.com leaves search (epic krizaka/.github#119)", () => {
  const setup = () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.kachizaka.com");
    vi.stubEnv("APP_DEV_HOST", "dev.kachizaka.com");
  };

  it("www is indexed even on a deployment that is closed elsewhere: no noindex, robots.txt and the sitemap are the app's", () => {
    setup();
    expect(as("www.kachizaka.com", "/en").headers.get("x-robots-tag")).toBeNull();
    expect(as("www.kachizaka.com", "/robots.txt").headers.get("content-type")).not.toBe("text/plain");
    expect(as("www.kachizaka.com", "/sitemap.xml").status).toBe(200);
  });

  it("dev: a page answers 308 to the same path on www, noindex", () => {
    setup();
    const res = as("dev.kachizaka.com", "/en/sign-in?next=%2Fapp");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.kachizaka.com/en/sign-in?next=%2Fapp");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("dev: robots.txt is Disallow: / with noindex; the API, .well-known and healthz keep serving with noindex", async () => {
    setup();
    const robots = as("dev.kachizaka.com", "/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    for (const path of ["/api/healthz", "/api/internal/sync", "/.well-known/assetlinks.json", "/healthz"]) {
      const res = as("dev.kachizaka.com", path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(res.headers.get("location"), path).toBeNull();
    }
  });

  it("the proxy sees the API and .well-known (to say noindex on dev), not the static files", () => {
    const patterns = config.matcher.join(" ");
    expect(patterns).toContain("/api/:path*");
    expect(patterns).toContain("/.well-known/:path*");
  });

  it("admin stays closed on every response", () => {
    setup();
    expect(as("admin.kachizaka.com", "/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
