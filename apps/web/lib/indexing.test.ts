import { describe, expect, it } from "vitest";

import { closedRobots, devRedirect, indexable, indexableOn, isDevHost, NOINDEX, publicHost } from "./indexing";

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

const ENV = { APP_SEARCH_INDEXING: "off", APP_PUBLIC_URL: "https://www.kachizaka.com", APP_DEV_HOST: "dev.kachizaka.com" };

describe("the public host is indexed, the dev host never (epic krizaka/.github#119)", () => {
  it("a closed deployment (off) stays closed everywhere but on the host of APP_PUBLIC_URL", () => {
    expect(publicHost(ENV)).toBe("www.kachizaka.com");
    expect(indexableOn("www.kachizaka.com", ENV)).toBe(true);
    expect(indexableOn("WWW.kachizaka.com:443", ENV)).toBe(true);
    expect(indexableOn("dev.kachizaka.com", ENV)).toBe(false);
    expect(indexableOn("admin.kachizaka.com", ENV)).toBe(false);
    expect(indexableOn("anything.test", ENV)).toBe(false);
    expect(indexableOn("dev.kachizaka.com", { APP_SEARCH_INDEXING: "on" })).toBe(true);
  });

  it("the dev host is the one APP_DEV_HOST names", () => {
    expect(isDevHost("dev.kachizaka.com", ENV)).toBe(true);
    expect(isDevHost("www.kachizaka.com", ENV)).toBe(false);
    expect(isDevHost("dev.kachizaka.com", {})).toBe(false);
  });

  it("on the dev host every HTML page goes to www (308 target, same path and query); the API, auth, webhooks, .well-known, healthz and robots stay", () => {
    const go = (path: string, method = "GET") => devRedirect(method, path.split("?")[0]!, path.includes("?") ? `?${path.split("?")[1]}` : "", "https://www.kachizaka.com");
    expect(go("/en")).toBe("https://www.kachizaka.com/en");
    expect(go("/en/sign-in?next=%2Fapp")).toBe("https://www.kachizaka.com/en/sign-in?next=%2Fapp");
    expect(go("/")).toBe("https://www.kachizaka.com/");
    expect(go("/sitemap.xml")).toBe("https://www.kachizaka.com/sitemap.xml");
    expect(go("/en", "HEAD")).toBe("https://www.kachizaka.com/en");
    for (const stay of ["/api/healthz", "/api/internal/sync", "/api/auth/callback", "/.well-known/assetlinks.json", "/healthz", "/robots.txt"]) expect(go(stay), stay).toBeNull();
    expect(go("/en/sign-in", "POST")).toBeNull();
    expect(go("/apix")).toBe("https://www.kachizaka.com/apix");
  });

  it("the dev host's robots.txt closes everything and names no sitemap", () => {
    expect(closedRobots(undefined)).toBe("User-agent: *\nDisallow: /\n");
  });
});
