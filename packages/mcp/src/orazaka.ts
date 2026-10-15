import { type z } from "zod";

import { type EventsInput, eventsInput, eventsOutput, type FixturesInput, fixturesInput, fixturesOutput, type SportsFeed, TOOLS } from "./contract";

export class FeedError extends Error {
  constructor(
    readonly code: "FEED_NOT_CONFIGURED" | "FEED_UNAVAILABLE" | "FEED_KEY" | "FEED_REFUSED" | "FEED_SHAPE",
    message: string,
  ) {
    super(message);
    this.name = "FeedError";
  }
}

/**
 * The sports feed through Orazaka's edge: each tool runs as `POST {baseUrl}/api/v1/mcp/tools/{name}/execute` with the
 * tool's arguments, authenticated by Kachizaka's `oz_` service key. Input and output are checked against the contract
 * on both sides — a malformed answer is refused, never guessed.
 */
export function orazakaSportsFeed(options: { baseUrl: string; apiKey: string | undefined; fetch?: typeof fetch; timeoutMs?: number }): SportsFeed {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  async function execute<I, O>(tool: string, input: z.ZodType<I>, output: z.ZodType<O>, args: I): Promise<O> {
    if (!options.apiKey) throw new FeedError("FEED_NOT_CONFIGURED", "AI_API_KEY is not set");
    const body = input.parse(args);
    let res: Response;
    try {
      res = await doFetch(`${base}/api/v1/mcp/tools/${encodeURIComponent(tool)}/execute`, {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ arguments: body }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
    } catch {
      throw new FeedError("FEED_UNAVAILABLE", `Orazaka did not answer on ${tool}`);
    }
    if (res.status === 401 || res.status === 403) throw new FeedError("FEED_KEY", `Orazaka refused Kachizaka's key on ${tool}`);
    if (!res.ok) throw new FeedError(res.status >= 500 ? "FEED_UNAVAILABLE" : "FEED_REFUSED", `Orazaka answered ${res.status} on ${tool}`);
    const json = (await res.json().catch(() => undefined)) as { result?: unknown } | undefined;
    const parsed = output.safeParse(json && typeof json === "object" && "result" in json ? json.result : json);
    if (!parsed.success) throw new FeedError("FEED_SHAPE", `The answer of ${tool} does not match the contract`);
    return parsed.data;
  }
  return {
    fixtures: (args: FixturesInput) => execute(TOOLS.fixtures, fixturesInput, fixturesOutput, args),
    events: (args: EventsInput) => execute(TOOLS.events, eventsInput, eventsOutput, args),
  };
}
