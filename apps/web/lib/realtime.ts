import { leagueTopic, REALTIME_CHANNEL } from "@kachizaka/core";
import { createBus, type RealtimeBus } from "@krizaka/realtime";
import { pgChannel } from "@krizaka/realtime/pg";

import { pool } from "./db";
import { readEnv } from "./env";

/**
 * The app's one realtime door (@krizaka/realtime): PostgreSQL LISTEN/NOTIFY by default — no extra service to run or pay
 * for. LISTEN needs a session, so it uses DATABASE_DIRECT_URL (never a transaction pooler); NOTIFY goes through the pool.
 * Best-effort by contract: the standings live in the database; an event only says "read again".
 */
const holder = globalThis as unknown as { __kachizakaBus?: RealtimeBus };

export function realtimeBus(): RealtimeBus {
  if (holder.__kachizakaBus) return holder.__kachizakaBus;
  const env = readEnv();
  holder.__kachizakaBus =
    env.REALTIME_BUS === "memory"
      ? createBus({ kind: "memory" })
      : createBus({ kind: "postgres", channel: REALTIME_CHANNEL, postgres: pgChannel({ listen: env.DATABASE_DIRECT_URL ?? env.DATABASE_URL ?? "", notify: pool() }) });
  return holder.__kachizakaBus;
}

export { leagueTopic };
