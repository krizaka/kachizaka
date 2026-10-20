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

  it("refuses the non-licensed sources everywhere but a closed (dev) deployment", () => {
    expect(unlicensedSourcesAllowed({ APP_SEARCH_INDEXING: "off" })).toBe(true);
    expect(unlicensedSourcesAllowed({ APP_SEARCH_INDEXING: "on" })).toBe(false);
    expect(unlicensedSourcesAllowed({})).toBe(false);
  });
});
