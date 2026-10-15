import { matchEventSchema } from "@kachizaka/core";
import { z } from "zod";

/**
 * The sports-feed connector, as Kachizaka reads it. The feed itself (a licensed provider — K0 decides which) is an MCP
 * server registered on **Orazaka** (`/api/v1/mcp/servers/platform`); Kachizaka never calls a provider directly, it
 * executes the connector's tools through Orazaka's edge with its service key (`POST /api/v1/mcp/tools/{name}/execute`).
 * These are the two tools and their shapes — the contract a provider adapter must honour.
 */
export const TOOLS = {
  /** The fixtures of a competition between two dates. */
  fixtures: "sportsFeed.fixtures",
  /** The facts of one match after a sequence number (0 = from the start), in order. */
  events: "sportsFeed.events",
} as const;

export const fixturesInput = z.object({ competition: z.string().min(1), from: z.iso.date(), to: z.iso.date() }).strict();
export const fixtureSchema = z.object({
  providerMatchId: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  kickoffAt: z.iso.datetime({ offset: true }),
  isFinal: z.boolean().default(false),
});
export const fixturesOutput = z.object({ provider: z.string().min(1), fixtures: z.array(fixtureSchema) });

export const eventsInput = z.object({ providerMatchId: z.string().min(1), afterSeq: z.number().int().min(0) }).strict();
export const eventsOutput = z.object({ provider: z.string().min(1), providerMatchId: z.string().min(1), events: z.array(matchEventSchema) });

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixturesInput = z.infer<typeof fixturesInput>;
export type FixturesOutput = z.infer<typeof fixturesOutput>;
export type EventsInput = z.infer<typeof eventsInput>;
export type EventsOutput = z.infer<typeof eventsOutput>;

/** What the pipeline needs from a feed — the Orazaka client and the fake connector both implement it. */
export interface SportsFeed {
  fixtures(input: FixturesInput): Promise<FixturesOutput>;
  events(input: EventsInput): Promise<EventsOutput>;
}
