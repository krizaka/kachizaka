import { z } from "zod";

/**
 * A match fact, as a connector delivers it (Orazaka's MCP sports-feed connector, or the fake one in tests). Each fact
 * has the provider's id (idempotency: the same fact twice is one fact) and a sequence number per match (order: fact
 * n + 1 is applied only after fact n). A correction is a fact too — it sets the score the provider now states.
 */
export const matchEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("kickoff"), providerEventId: z.string().min(1), seq: z.number().int().min(1), at: z.string() }),
  z.object({ kind: z.literal("goal"), providerEventId: z.string().min(1), seq: z.number().int().min(1), at: z.string(), side: z.enum(["home", "away"]), minute: z.number().int().min(0).max(200).optional() }),
  z.object({ kind: z.literal("correction"), providerEventId: z.string().min(1), seq: z.number().int().min(1), at: z.string(), home: z.number().int().min(0), away: z.number().int().min(0) }),
  z.object({ kind: z.literal("final"), providerEventId: z.string().min(1), seq: z.number().int().min(1), at: z.string() }),
]);
export type MatchEvent = z.infer<typeof matchEventSchema>;

export type MatchStatus = "scheduled" | "live" | "final";
export interface MatchState {
  status: MatchStatus;
  home: number;
  away: number;
  /** The last sequence number applied. */
  appliedSeq: number;
}

export const INITIAL_STATE: MatchState = { status: "scheduled", home: 0, away: 0, appliedSeq: 0 };

/** One fact on a state — the only place a match's score changes. A fact after the final whistle is a correction or nothing. */
export function applyEvent(state: MatchState, event: MatchEvent): MatchState {
  const next = { ...state, appliedSeq: event.seq };
  switch (event.kind) {
    case "kickoff":
      return { ...next, status: state.status === "final" ? "final" : "live" };
    case "goal":
      if (state.status === "final") return next;
      return { ...next, status: "live", home: state.home + (event.side === "home" ? 1 : 0), away: state.away + (event.side === "away" ? 1 : 0) };
    case "correction":
      return { ...next, home: event.home, away: event.away };
    case "final":
      return { ...next, status: "final" };
  }
}

/**
 * Applies what can be applied, in order: from the facts received (any order, duplicates included), those that follow
 * `appliedSeq` without a gap. A fact already applied is ignored (idempotent); a fact after a gap waits for the missing
 * one. Returns the new state and the facts applied, in order.
 */
export function applyInOrder(state: MatchState, received: readonly MatchEvent[]): { state: MatchState; applied: MatchEvent[] } {
  const bySeq = new Map<number, MatchEvent>();
  for (const e of received) if (e.seq > state.appliedSeq && !bySeq.has(e.seq)) bySeq.set(e.seq, e);
  const applied: MatchEvent[] = [];
  let current = state;
  for (let seq = state.appliedSeq + 1; bySeq.has(seq); seq++) {
    const e = bySeq.get(seq)!;
    current = applyEvent(current, e);
    applied.push(e);
  }
  return { state: current, applied };
}
