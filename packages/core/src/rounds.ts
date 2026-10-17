/**
 * A league's weekly round: the games kicking off between Monday 00:00 and Sunday 24:00 (the league's time zone), named
 * like an ISO week (`2026-W42`). Pure: the zone is a parameter, the clock is never read.
 */
export function roundOf(kickoff: Date, zone = "America/Toronto"): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(kickoff).map((x) => [x.type, x.value]));
  const weekday = (new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - weekday + 3)); // the Thursday decides the week's year
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const days = (Date.UTC(year, thursday.getUTCMonth(), thursday.getUTCDate()) - Date.UTC(year, 0, 4)) / 86_400_000;
  const week = 1 + Math.round((days + ((jan4.getUTCDay() + 6) % 7) - 3) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
