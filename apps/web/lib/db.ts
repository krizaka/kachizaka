import path from "node:path";

import { createDb, type Db, migrate as migrateSchema, pg, poolConfig as dbPoolConfig } from "@kachizaka/db";

import { readEnv } from "./env";

/**
 * One pool per process, on the shared rules of @kachizaka/db (TLS verified against DATABASE_CA_CERT, never
 * `rejectUnauthorized: false`). `query` for the account and session SQL, `db()` for the Drizzle schema.
 */
export function poolConfig(source: Record<string, string | undefined> = process.env): pg.PoolConfig {
  const env = readEnv(source);
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return dbPoolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT);
}

const holder = globalThis as unknown as { __kachizakaPool?: pg.Pool; __kachizakaDb?: Db };

export function pool(): pg.Pool {
  holder.__kachizakaPool ??= new pg.Pool(poolConfig());
  return holder.__kachizakaPool;
}

export function db(): Db {
  holder.__kachizakaDb ??= createDb(pool());
  return holder.__kachizakaDb;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool().query<T>(text, values);
  return result.rows;
}

/**
 * The versioned migrations of @kachizaka/db (packages/db/drizzle), applied at start under an advisory lock. Resolved
 * from the app's directory — the same relative path in development and in the standalone server, which carries the
 * folder (next.config `outputFileTracingIncludes`).
 */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), "../../packages/db/drizzle");
export async function migrate(): Promise<void> {
  await migrateSchema(pool(), MIGRATIONS_DIR);
}
