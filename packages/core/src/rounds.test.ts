import { describe, expect, it } from "vitest";

import { roundOf } from "./rounds";

describe("a weekly round", () => {
  it("is the ISO week of the kick-off, in the league's zone", () => {
    expect(roundOf(new Date("2026-10-17T23:00:00Z"))).toBe("2026-W42"); // Saturday evening in Montréal
    expect(roundOf(new Date("2026-10-19T12:00:00Z"))).toBe("2026-W43"); // the Monday after
    expect(roundOf(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53"); // ISO: that Friday still belongs to 2026's last week
  });
  it("agrees with the ISO calendar around the new year", () => {
    expect([ "2026-01-01", "2026-12-28", "2027-01-03", "2027-01-04", "2024-12-30"].map((d) => roundOf(new Date(`${d}T17:00:00Z`)))).toEqual(["2026-W01", "2026-W53", "2026-W53", "2027-W01", "2025-W01"]);
  });
  it("puts Sunday night in the week that ends, not the one that starts, by local time", () => {
    expect(roundOf(new Date("2026-10-19T02:00:00Z"))).toBe("2026-W42"); // Sunday 22:00 in Montréal, already Monday in UTC
  });
});
