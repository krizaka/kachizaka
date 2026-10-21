import { describe, expect, it } from "vitest";

import { readEnv } from "./env";
import { syncAuthorised, unlicensedSourcesAllowed } from "./sync-auth";

const TOKEN = "t".repeat(40);

describe("the door of the scheduled sync", () => {
  it("does not exist without a token (production), or with a token too short to be one", () => {
    expect(syncAuthorised(`Bearer ${TOKEN}`, undefined)).toBe("absent");
    expect(syncAuthorised("Bearer short", "short")).toBe("absent");
    expect(readEnv({}).OPERATOR_SYNC_TOKEN).toBeUndefined();
  });
  it("opens for the token alone", () => {
    expect(syncAuthorised(`Bearer ${TOKEN}`, TOKEN)).toBe("open");
    expect(syncAuthorised(`Bearer ${"u".repeat(40)}`, TOKEN)).toBe("refused");
    expect(syncAuthorised(TOKEN, TOKEN)).toBe("refused");
    expect(syncAuthorised(null, TOKEN)).toBe("refused");
  });

  it("never keys the non-licensed sources off APP_SEARCH_INDEXING: a deployment that does not say so serves only licensed or open ones", () => {
    for (const host of ["dev.kachizaka.com", "www.kachizaka.com", null]) {
      expect(unlicensedSourcesAllowed({ APP_SEARCH_INDEXING: "off" }, host)).toBe(false);
      expect(unlicensedSourcesAllowed({ APP_SEARCH_INDEXING: "on" }, host)).toBe(false);
      expect(unlicensedSourcesAllowed({}, host)).toBe(false);
    }
  });

  it("allows them only when APP_UNLICENSED_SOURCES=on AND the request is not for the public host (www)", () => {
    const env = { APP_UNLICENSED_SOURCES: "on", APP_PUBLIC_URL: "https://www.kachizaka.com" };
    expect(unlicensedSourcesAllowed(env, "dev.kachizaka.com")).toBe(true);
    expect(unlicensedSourcesAllowed(env, "localhost:3000")).toBe(true);
    expect(unlicensedSourcesAllowed(env, "www.kachizaka.com")).toBe(false);
    expect(unlicensedSourcesAllowed(env, "WWW.kachizaka.com:443")).toBe(false);
    expect(unlicensedSourcesAllowed(env, null)).toBe(false);
    expect(unlicensedSourcesAllowed({ ...env, APP_UNLICENSED_SOURCES: "off" }, "dev.kachizaka.com")).toBe(false);
  });

  it("the deployed spec does not turn them on, and the route asks with the request's host", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const spec = readFileSync(join(__dirname, "../../../deploy/digitalocean/app.yaml"), "utf8");
    expect(spec.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n")).not.toMatch(/APP_UNLICENSED_SOURCES/);
    const route = readFileSync(join(__dirname, "../app/api/internal/sync/route.ts"), "utf8");
    expect(route).toMatch(/unlicensedSourcesAllowed\(process\.env, req\.headers\.get\("host"\)\)/);
  });
});
