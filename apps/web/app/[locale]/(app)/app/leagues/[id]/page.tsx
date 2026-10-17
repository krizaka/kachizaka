import { bandRange } from "@kachizaka/core";
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
import { ruleLines } from "@/lib/rules-view";

const INTL: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };
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
  const sports = getDictionary(locale).landing.league.sports;
  const bandText = (edges: readonly number[], i: number) => {
    const r = bandRange(edges, i);
    return r.to === null ? format(t.rules.bandOpen, { from: r.from }) : format(t.rules.bandsValue, { from: r.from, to: r.to });
  };
  const pickText = (m: (typeof view.matches)[number]) => {
    const p = m.mine!;
    if (m.sport === "basketball") {
      const edges = ((view.rules.find((r) => r.sport === "basketball")?.values.bands as number[] | undefined) ?? []) as number[];
      const range = bandRange(edges, p.band ?? 0);
      const team = p.winner === "home" ? m.home : m.away;
      return range.to === null ? format(t.matches.mineWinnerOpen, { team, from: range.from }) : format(t.matches.mineWinner, { team, from: range.from, to: range.to });
    }
    return format(m.sport === "hockey" && p.overtime ? t.matches.mineOvertime : t.matches.mine, { home: p.home ?? 0, away: p.away ?? 0 });
  };
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
          {view.rules.length ? (
            <div className="flex flex-col gap-5">
              {view.rules.map((r) => (
                <section key={r.sport} aria-label={format(t.matches.sportTitle, { sport: sports[r.sport] })} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-fg">{sports[r.sport]}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.sealedAt ? "success" : "warning"}>{r.sealedAt ? t.rules.sealed : t.rules.open}</Badge>
                    <span className="font-mono text-xs text-fg-muted">{format(t.rules.version, { version: r.version })}</span>
                    {!r.holds ? <Badge tone="danger">{t.rules.broken}</Badge> : null}
                  </div>
                  <DescriptionList
                    items={ruleLines(r.sport, r.values).map((l) => ({
                      term: t.rules.names[l.id as keyof typeof t.rules.names],
                      details: l.kind === "multiplier" ? `×${l.value}` : l.kind === "bands" ? l.value.map((_, i) => bandText(l.value, i)).concat(bandText(l.value, l.value.length)).join(" · ") : format(t.rules.points, { points: l.value }),
                    }))}
                  />
                  <p className="text-sm text-fg-secondary">{r.sealedAt ? format(t.rules.sealedAt, { date: when(r.sealedAt) }) : t.rules.openNote}</p>
                  <details className="text-xs text-fg-muted">
                    <summary className="cursor-pointer">{t.rules.sealLabel}</summary>
                    <p className="mt-1 break-all font-mono">{r.seal}</p>
                  </details>
                </section>
              ))}
            </div>
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
                  {m.home} {m.status === "scheduled" ? "–" : `${m.homeScore} – ${m.awayScore}`} {m.away}{m.overtime ? ` (${t.matches.overtimeTag})` : ""}
                </span>
                <span className="flex items-center gap-2">
                  {m.competition ? <Badge tone="neutral">{m.competition}</Badge> : null}
                  {m.isFinal ? <Badge tone="accent">{t.matches.final}</Badge> : null}
                  <Badge tone={STATUS_TONE[m.status]}>{t.matches.statuses[m.status]}</Badge>
                </span>
              </div>
              <p className="mt-1 text-fg-muted">{when(m.kickoffAt)}</p>
              {m.mine ? (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="text-fg-secondary">{pickText(m)}</p>
                  {m.mine.points !== null ? (
                    <p className="text-fg">
                      <strong className="font-semibold">{format(t.matches.points, { points: m.mine.points })}</strong>
                      {m.mine.provisional ? ` · ${t.matches.provisional}` : ""}
                      {m.mine.breakdown.length ? ` — ${m.mine.breakdown.map((l) => `${t.rules.names[l.rule as keyof typeof t.rules.names]} +${l.points}`).join(" · ")}` : ` — ${t.matches.nothing}`}
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
