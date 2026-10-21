import { bandRange } from "@kachizaka/core";
import { ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Section } from "@krizaka/ui/page";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InviteCard } from "@/components/app/InviteCard";
import { LiveStandings } from "@/components/app/LiveStandings";
import { type PickTarget, ScorePick, WinnerBandPick } from "@/components/app/PickForms";
import { RevealTable } from "@/components/app/RevealTable";
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
  const bandEdges = ((view.rules.find((r) => r.sport === "basketball")?.values.bands as number[] | undefined) ?? []) as number[];
  const bandWords = bandEdges.concat(0).map((_, i) => {
    const range = bandRange(bandEdges, i);
    return range.to === null ? format(t.picks.bandOpenOption, { from: range.from }) : format(t.picks.bandOption, { from: range.from, to: range.to });
  });
  type PickLike = { home: number | null; away: number | null; winner: "home" | "away" | null; band: number | null; overtime: boolean };
  const pickText = (m: (typeof view.matches)[number], p: PickLike) => {
    if (m.sport === "basketball") {
      const range = bandRange(bandEdges, p.band ?? 0);
      const team = p.winner === "home" ? m.home : m.away;
      return range.to === null ? format(t.matches.mineWinnerOpen, { team, from: range.from }) : format(t.matches.mineWinner, { team, from: range.from, to: range.to });
    }
    return format(m.sport === "hockey" && p.overtime ? t.matches.mineOvertime : t.matches.mine, { home: p.home ?? 0, away: p.away ?? 0 });
  };
  const why = (lines: { rule: string; points: number }[]) => (lines.length ? lines.map((l) => `${t.rules.names[l.rule as keyof typeof t.rules.names]} +${l.points}`).join(" · ") : t.matches.nothing);
  const roundNumber = (round: string) => Number(round.split("-W")[1]);
  const origin = `https://${(await headers()).get("host") ?? "dev.kachizaka.com"}`;
  const upcoming = view.matches.filter((m) => m.status === "scheduled" && new Date(m.kickoffAt) > new Date());
  const rounds = [...new Set(upcoming.map((m) => m.round))].map((round) => ({ round, matches: upcoming.filter((m) => m.round === round) }));
  const target = (m: (typeof view.matches)[number]): PickTarget => ({
    leagueId: view.league.id,
    matchId: m.id,
    sport: m.sport,
    home: m.home,
    away: m.away,
    initial: m.mine ? { home: m.mine.home, away: m.mine.away, overtime: m.mine.overtime, winner: m.mine.winner, band: m.mine.band } : undefined,
    bands: bandWords,
  });
  const played = view.matches.filter((m) => !upcoming.includes(m)).reverse();
  const recent = played.slice(0, 10);
  const when = (iso: string) => new Date(iso).toLocaleString(INTL[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{view.league.name}</h1>
        {view.season ? <p className="text-fg-secondary">{format(t.season, { label: view.season.label, competition: view.season.competition })}</p> : <p className="text-fg-secondary">{t.noSeason}</p>}
      </header>

      <section aria-label={t.stats.title}>
        <StatGrid>
          <Stat label={t.stats.rank} value={view.stats.rank ?? t.stats.none} />
          <Stat label={t.stats.points} value={view.stats.points} />
          <Stat label={t.stats.perfect} value={view.stats.perfect} hint={format(t.stats.picksHint, { count: view.stats.picks })} />
          <Stat label={t.stats.streak} value={view.stats.streak} hint={t.stats.streakHint} />
        </StatGrid>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card.Root className="p-4">
          <h2 className="mb-3 font-display text-base font-bold text-fg">{t.standings}</h2>
          <LiveStandings leagueId={view.league.id} rows={view.table} me={view.me.memberId} version={view.tableVersion} />
        </Card.Root>
        <InviteCard leagueId={view.league.id} base={`/${locale}/app`} origin={origin} />
      </div>

      <Section eyebrow={t.picks.eyebrow} title={t.picks.title}>
        {rounds.length ? (
          <div className="flex flex-col gap-8">
            {rounds.map((r, i) => (
              <details key={r.round} open={i === 0} className="group flex flex-col gap-3">
                <summary className="flex cursor-pointer items-baseline justify-between gap-3 font-display text-sm font-bold text-fg-secondary">
                  {format(t.picks.round, { n: roundNumber(r.round) })}
                  <span className="font-mono text-xs font-normal normal-case tracking-normal text-fg-muted">{format(t.picks.count, { count: r.matches.length, mine: r.matches.filter((m) => m.mine).length })}</span>
                </summary>
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {r.matches.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-1 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-fg">
                          {m.home} – {m.away}
                        </span>
                        {m.competition ? <Badge tone="neutral">{m.competition}</Badge> : null}
                      </div>
                      <p className="text-fg-muted">{format(t.picks.closes, { date: when(m.kickoffAt) })}</p>
                      {m.sport === "basketball" ? <WinnerBandPick target={target(m)} /> : <ScorePick target={target(m)} />}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-fg-secondary">{t.picks.empty}</p>
        )}
      </Section>

      <Section eyebrow={t.matches.eyebrow} title={t.matches.title}>
        <ul className="flex flex-col gap-3">
          {recent.map((m) => {
            const rows = (view.reveals[m.id] ?? []).map((r) => ({ id: r.memberId, name: r.name, me: r.memberId === view.me.memberId, pick: pickText(m, r), points: r.points, why: r.points === null ? "" : why(r.breakdown), perfect: r.perfect }));
            return (
              <li key={m.id} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-fg">
                    {m.home} {m.status === "scheduled" ? "–" : `${m.homeScore} – ${m.awayScore}`} {m.away}
                    {m.overtime ? ` (${t.matches.overtimeTag})` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    {m.competition ? <Badge tone="neutral">{m.competition}</Badge> : null}
                    {m.isFinal ? <Badge tone="accent">{t.matches.final}</Badge> : null}
                    <Badge tone={STATUS_TONE[m.status]}>{t.matches.statuses[m.status]}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-fg-muted">{when(m.kickoffAt)}</p>
                {m.status === "scheduled" ? null : rows.length ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-fg-secondary">{t.reveal.title}</h3>
                    <RevealTable rows={rows} text={{ caption: `${m.home} – ${m.away}`, member: t.reveal.member, pick: t.reveal.pick, points: t.reveal.points, why: t.reveal.why, perfect: t.reveal.perfect, you: t.table.you, none: t.reveal.none }} />
                  </div>
                ) : (
                  <p className="mt-2 text-fg-muted">{t.reveal.none}</p>
                )}
              </li>
            );
          })}
          {!played.length ? <li className="text-fg-secondary">{t.matches.none}</li> : null}
        </ul>
        <p className="mt-3 text-xs text-fg-muted">{t.reveal.hint}</p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
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

      </div>
    </div>
  );
}
