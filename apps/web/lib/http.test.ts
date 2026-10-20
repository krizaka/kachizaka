import { describe, expect, it } from "vitest";

import { handle, refuse } from "./http";

describe("every API answer carries a request id (the proof a recorded journey is a real run)", () => {
  it("on success, on a refusal and on an unexpected error", async () => {
    const ok = await handle(async () => Response.json({ ok: true }));
    const refused = await handle(async () => {
      throw refuse(403, "FORBIDDEN", "no");
    });
    const broken = await handle(async () => {
      throw new Error("boom");
    });
    const ids = [ok, refused, broken].map((r) => r.headers.get("x-request-id"));
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id ?? ""))).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(broken.status).toBe(500);
    expect(await broken.text()).not.toContain("boom");
  });
});
