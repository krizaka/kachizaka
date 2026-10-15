const INTL = { en: "en-CA", fr: "fr-CA" } as const;

/** A date for the console: medium date, and the time when asked. */
export function formatDate(iso: string, locale: "en" | "fr", time = false): string {
  return new Date(iso).toLocaleString(INTL[locale], time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
