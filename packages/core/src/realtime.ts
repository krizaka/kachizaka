/**
 * The realtime topics of Kachizaka (@krizaka/realtime, PostgreSQL LISTEN/NOTIFY by default): one NOTIFY channel for the
 * app, one topic per league and per match. Payloads are small facts — ids and numbers; the standings themselves are
 * re-read from the database by whoever listens (the bus is best-effort, the database is the truth).
 */
export const REALTIME_CHANNEL = "kachizaka_events";
export const leagueTopic = (leagueId: string) => `league:${leagueId}`;
export const matchTopic = (matchId: string) => `match:${matchId}`;

export type LeagueEvent = { type: "standings"; leagueId: string; seasonId: string; version: number } | { type: "match"; matchId: string; status: "live" | "final"; home: number; away: number; seq: number };
