import { applyInOrder, INITIAL_STATE, type LeagueEvent, type MatchEvent } from "@kachizaka/core";
import { describe, expect, it } from "vitest";

import { eventsOutput, FakeSportsFeed, FeedError, orazakaSportsFeed, syncMatch, TOOLS } from "./index";

const at = "2026-10-15T23:00:00Z";
const GAME: MatchEvent[] = [
  { kind: "kickoff", providerEventId: "e1", seq: 1, at },
  { kind: "goal", providerEventId: "e2", seq: 2, at, side: "home" },
  { kind: "final", providerEventId: "e3", seq: 3, at },
];

describe("the Orazaka sports-feed client", () => {
  it("executes the connector's tool on the edge with the service key, and reads the result against the contract", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const feed = orazakaSportsFeed({
      baseUrl: "https://dev.orazaka.com/edge/",
      apiKey: "oz_test",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Response.json({ result: { provider: "nhl", providerMatchId: "M1", events: GAME } });
      }) as typeof fetch,
    });
    const out = await feed.events({ providerMatchId: "M1", afterSeq: 0 });
    expect(out.events).toHaveLength(3);
    expect(calls[0]!.url).toBe(`https://dev.orazaka.com/edge/api/v1/mcp/tools/${TOOLS.events}/execute`);
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe("Bearer oz_test");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ arguments: { providerMatchId: "M1", afterSeq: 0 } });
  });

  it.each([
    [401, "FEED_KEY"],
    [404, "FEED_REFUSED"],
    [503, "FEED_UNAVAILABLE"],
  ])("turns a %i into %s", async (status, code) => {
    const feed = orazakaSportsFeed({ baseUrl: "https://x", apiKey: "oz_k", fetch: (async () => new Response("no", { status })) as unknown as typeof fetch });
    await expect(feed.fixtures({ competition: "NHL", from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({ code });
  });

  it("refuses an answer outside the contract, and runs nothing without a key", async () => {
    const bad = orazakaSportsFeed({ baseUrl: "https://x", apiKey: "oz_k", fetch: (async () => Response.json({ events: [{ kind: "bet" }] })) as unknown as typeof fetch });
    await expect(bad.events({ providerMatchId: "M1", afterSeq: 0 })).rejects.toMatchObject({ code: "FEED_SHAPE" });
    await expect(orazakaSportsFeed({ baseUrl: "https://x", apiKey: undefined }).events({ providerMatchId: "M1", afterSeq: 0 })).rejects.toBeInstanceOf(FeedError);
  });

  it("validates the arguments before sending them", async () => {
    const feed = orazakaSportsFeed({ baseUrl: "https://x", apiKey: "oz_k", fetch: (async () => Response.json({})) as unknown as typeof fetch });
    await expect(feed.events({ providerMatchId: "", afterSeq: -1 })).rejects.toThrow();
  });
});

describe("one pass of the live loop, with the fake connector", () => {
  it("brings a match to its end however the feed repeats and shuffles, broadcasting what changed", async () => {
    const feed = new FakeSportsFeed({ fixtures: [], events: { M1: GAME } }, { repeat: true, shuffle: true });
    let state = INITIAL_STATE;
    const published: LeagueEvent[] = [];
    const ingest = async (matchId: string, events: MatchEvent[]) => {
      const r = applyInOrder(state, events);
      state = r.state;
      return { applied: r.applied.length, events: r.applied.length ? [{ type: "match" as const, matchId, status: state.status === "final" ? ("final" as const) : ("live" as const), home: state.home, away: state.away, seq: state.appliedSeq }] : [] };
    };
    for (const visible of [1, 1, 3, 3]) {
      feed.reveal("M1", visible);
      await syncMatch({ feed, match: { id: "m1", providerMatchId: "M1", appliedSeq: state.appliedSeq }, ingest, publish: (e) => void published.push(e) });
    }
    expect(state).toEqual({ status: "final", home: 1, away: 0, appliedSeq: 3 });
    expect(published.map((e) => (e.type === "match" ? e.seq : 0))).toEqual([1, 3]);
    expect(eventsOutput.safeParse(await feed.events({ providerMatchId: "M1", afterSeq: 0 })).success).toBe(true);
  });

  it("lists fixtures within the dates asked", async () => {
    const feed = new FakeSportsFeed({ fixtures: [{ sport: "soccer", providerMatchId: "M1", homeTeam: "Montréal", awayTeam: "Toronto", kickoffAt: "2026-10-15T23:00:00Z", isFinal: false }], events: {} });
    expect((await feed.fixtures({ competition: "NHL", from: "2026-10-15", to: "2026-10-15" })).fixtures).toHaveLength(1);
    expect((await feed.fixtures({ competition: "NHL", from: "2026-10-16", to: "2026-10-20" })).fixtures).toHaveLength(0);
  });
});
