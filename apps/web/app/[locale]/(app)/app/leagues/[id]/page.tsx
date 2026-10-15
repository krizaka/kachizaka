import { ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Section } from "@krizaka/ui/page";
import { notFound } from "next/navigation";
import { z } from "zod";

import { LiveStandings } from "@/components/app/LiveStandings";
import { pageSession } from "@/lib/access";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { leagueView } from "@/lib/leagues";

const INTL: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };
const RULE_ORDER = ["exactScore", "outcome", "goalDifference", "teamGoals", "finalMultiplier"] as const;
const STATUS_TONE = { scheduled: "neutral", live: "accent", final: "success" } as const;

/**
 * A league: its rules and their seal (the hash stored at kick-off — the rules cannot change under a running match), the
 * live table, and each match with the member's prediction and the lines that earned its points.
 */
export default async function League({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const t = getDictionary(locale).console.league;
  const session = (await pageSession())!;
  const valid = z.uuid().safeParse(id);
  const view = valid.success ? await leagueView(valid.data, session.account.id) : null;
  if (!view) notFound();
  const when = (iso: string) => new Date(iso).toLocaleString(INTL[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{view.league.name}</h1>
        {view.season ? <p className="text-fg-secondary">{format(t.season, { label: view.season.label, competition: view.season.competition })}</p> : <p className="text-fg-secondary">{t.noSeason}</p>}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card.Root className="p-4" aria-labelledby="rules-title">
          <h2 id="rules-title" className="mb-3 flex items-center gap-2 font-display text-base font-bold text-fg">
            <ShieldIcon size={18} aria-hidden /> {t.rules.title}
          </h2>
          {view.rules ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={view.rules.sealedAt ? "success" : "warning"}>{view.rules.sealedAt ? t.rules.sealed : t.rules.open}</Badge>
                <span className="font-mono text-xs text-fg-muted">{format(t.rules.version, { version: view.rules.version })}</span>
                {!view.rules.holds ? <Badge tone="danger">{t.rules.broken}</Badge> : null}
              </div>
              <DescriptionList items={RULE_ORDER.map((r) => ({ term: t.rules.names[r], details: r === "finalMultiplier" ? `×${view.rules!.values[r] ?? 1}` : format(t.rules.points, { points: view.rules!.values[r] ?? 0 }) }))} />
              <p className="mt-3 text-sm text-fg-secondary">{view.rules.sealedAt ? format(t.rules.sealedAt, { date: when(view.rules.sealedAt) }) : t.rules.openNote}</p>
              <p className="mt-2 break-all font-mono text-xs text-fg-muted" title={t.rules.sealLabel}>
                {view.rules.seal}
              </p>
            </>
          ) : (
            <p className="text-fg-secondary">{t.rules.none}</p>
          )}
        </Card.Root>

        <Card.Root className="p-4">
          <h2 className="mb-3 font-display text-base font-bold text-fg">{t.standings}</h2>
          <LiveStandings leagueId={view.league.id} rows={view.table} me={view.me.memberId} version={view.tableVersion} />
        </Card.Root>
      </div>

      <Section eyebrow={t.matches.eyebrow} title={t.matches.title}>
        <ul className="flex flex-col gap-2">
          {view.matches.map((m) => (
            <li key={m.id} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-fg">
                  {m.home} {m.status === "scheduled" ? "–" : `${m.homeScore} – ${m.awayScore}`} {m.away}
                </span>
                <span className="flex items-center gap-2">
                  {m.isFinal ? <Badge tone="accent">{t.matches.final}</Badge> : null}
                  <Badge tone={STATUS_TONE[m.status]}>{t.matches.statuses[m.status]}</Badge>
                </span>
              </div>
              <p className="mt-1 text-fg-muted">{when(m.kickoffAt)}</p>
              {m.mine ? (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="text-fg-secondary">{format(t.matches.mine, { home: m.mine.home, away: m.mine.away })}</p>
                  {m.mine.points !== null ? (
                    <p className="text-fg">
                      <strong className="font-semibold">{format(t.matches.points, { points: m.mine.points })}</strong>
                      {m.mine.provisional ? ` · ${t.matches.provisional}` : ""}
                      {m.mine.breakdown.length ? ` — ${m.mine.breakdown.map((l) => `${t.rules.names[l.rule]} +${l.points}`).join(" · ")}` : ` — ${t.matches.nothing}`}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-fg-muted">{m.status === "scheduled" ? t.matches.noneYet : t.matches.none}</p>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
