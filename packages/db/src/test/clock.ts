/** A game's kickoff for a test: tomorrow at 23:00 UTC from `now`, so the database's own clock (the predictions lock,
    `kz_predictions_locked()`, reads `now()`) agrees with the clock the test hands to the code. Never a calendar date in a
    test: one written as « 2026-10-20 » turned every run red the day it passed (kachizaka#85). */
export function kickoffAfter(now: Date): Date {
  const kickoff = new Date(now);
  kickoff.setUTCDate(kickoff.getUTCDate() + 1);
  kickoff.setUTCHours(23, 0, 0, 0);
  return kickoff;
}

/** `hours` after (or before, when negative) `at`. */
export function hoursFrom(at: Date, hours: number): Date {
  const d = new Date(at);
  d.setUTCHours(d.getUTCHours() + hours);
  return d;
}
