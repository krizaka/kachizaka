import { CheckIcon, ForwardIcon, KeepIcon, LockIcon, ShieldIcon, UsersIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { ComparisonTable } from "@krizaka/ui/comparison-table";
import { LandingPage } from "@krizaka/ui/landing-page";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { MetaRow } from "@krizaka/ui/meta-row";
import { NumberTicker } from "@krizaka/ui/number-ticker";
import { Section } from "@krizaka/ui/page";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqSection } from "@/components/home/FaqSection";
import { PointsBreakdown } from "@/components/home/PointsBreakdown";
import { LeagueStory } from "@/components/LeagueStory";
import { LeagueView, type LeagueViewText } from "@/components/LeagueView";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { env } from "@/lib/env";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { COMPARE_ROWS, productStatus, TRUST } from "@/lib/landing";
import { buildLeagueData, type LeagueData, SHOWCASE_LEAGUE } from "@/lib/league-view";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { loadShowcase } from "@/lib/showcase";
import { contactHref, pagePath, REPO_URL } from "@/lib/site";
import { PLANNED_RULES, READY_RULES, sportView } from "@/lib/sports";

import preview from "../../../../dev-preview.json";

/** Read at request (a minute's cache, lib/showcase.ts): the league's table is the database's, not a build's. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const EXAMPLE_STORY = sportView("soccer");

/** The league view's words: every line of points comes from the real scorer; basketball's rules are planned, said so. */
function leagueText(locale: Locale, data: LeagueData): LeagueViewText {
  const d = getDictionary(locale);
  const t = d.landing.league;
  const names = d.console.league.rules.names as Record<string, string>;
  const lines = (sport: "soccer" | "hockey") => READY_RULES[sport].map((r) => `${names[r.id]} — ${format(t.pts, { points: r.points })}`);
  const planned = PLANNED_RULES.basketball.map((id) => (t.rules.basketball as Record<string, string>)[id]);
  return {
    label: format(t.label, { name: data.name }), switch: t.switch, sports: t.sports, competitions: t.competitions, resultsTitle: t.resultsTitle,
    noResults: t.noResults, final: t.final, overtime: t.overtime, table: t.table, ready: t.ready, soon: t.soon, soonWhy: t.soonWhy,
    rulesSummary: t.rulesSummary, rulesLead: t.rulesLead, rulesPlannedLead: t.rulesPlannedLead, sealLabel: t.sealLabel,
    ruleLines: { soccer: lines("soccer"), hockey: lines("hockey"), basketball: planned },
    updated: data.updated,
    note: format(data.source === "league" ? t.note : t.noteExample, { name: data.name }),
  };
}

const TRUST_ICONS = { points: <CheckIcon />, sealed: <LockIcon />, open: <KeepIcon /> } as const;
const FEATURE_ICONS = { table: <UsersIcon />, sealed: <LockIcon />, points: <CheckIcon />, icons: <ShieldIcon /> } as const;

/**
 * dev.kachizaka.com — the product landing template of @krizaka/ui (`LandingPage`): the promise beside the league table (a sport
 * switch, the real scorer) in its window, a band of figures counted from the example league and the scorer, a bento, then our
 * sections — how a round works on a phone, how the points are earned, the comparison, trust, the FAQ — and the closing call.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const dict = getDictionary(locale);
  const d = dict.landing;
  const status = productStatus(preview);
  const story = d.how.phone;
  const soccer = EXAMPLE_STORY;
  const league = buildLeagueData(await loadShowcase(SHOWCASE_LEAGUE, { configured: Boolean(env().DATABASE_URL) }), locale);
  const trustHref = { points: pagePath(locale, "privacy"), sealed: `${REPO_URL}/tree/main/packages/core`, open: REPO_URL } as const;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <LandingPage
          id="hero"
          eyebrow={d.eyebrow}
          title={d.title}
          lead={d.lead}
          visualLabel={d.visualLabel}
          visual={<LeagueView bare views={league.sports} text={leagueText(locale, league)} />}
          actions={
            <>
              <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
                <a href={contactHref("dev-kachizaka-hero")}>
                  {d.talk} <ForwardIcon size={16} strokeWidth={2.25} />
                </a>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                <Link href="#how">{d.seeHow}</Link>
              </Button>
            </>
          }
          proofs={[
            { value: <NumberTicker value={league.friends} locale={locale} />, label: d.figures.friends },
            { value: <NumberTicker value={league.sportsLive} locale={locale} />, label: d.figures.sports },
            { value: <NumberTicker value={league.picksScored} locale={locale} />, label: d.figures.points },
          ]}
          featuresHeading={{ eyebrow: d.features.eyebrow, title: d.features.title, lead: d.features.lead }}
          features={[
            { id: "table", size: "lg", icon: FEATURE_ICONS.table, title: d.features.items.table.title, text: d.features.items.table.text },
            { id: "sealed", size: "md", icon: FEATURE_ICONS.sealed, title: d.features.items.sealed.title, text: d.features.items.sealed.text },
            { id: "points", size: "sm", icon: FEATURE_ICONS.points, title: d.features.items.points.title, text: d.features.items.points.text },
            { id: "icons", size: "sm", icon: FEATURE_ICONS.icons, title: d.features.items.icons.title, text: d.features.items.icons.text },
          ]}
          closing={{
            title: d.closing.title,
            body: d.closing.body,
            actions: (
              <Button asChild variant="primary" size="lg">
                <a href={contactHref("dev-kachizaka-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          {/* How a round works — four steps on a phone; the magpie keeps its promise. */}
          <Section id="how" eyebrow={d.how.eyebrow} title={d.how.title} lead={d.how.lead} reveal divider>
            <LeagueStory
              text={{
                label: story.label, example: story.example, steps: d.how.steps, leagueName: story.leagueName, invite: story.invite,
                copy: story.copy, sportsOn: story.sportsOn, yourPick: story.yourPick, locked: story.locked, tableTitle: story.tableTitle,
                updated: story.updated, season: story.season, round: story.round, cup: story.cup,
                match: `${soccer.match.home} – ${soccer.match.away}`,
                pick: dict.landing.league.pick,
                members: soccer.rows.map((r) => ({ name: r.member, points: r.points ?? 0 })),
              }}
            />
            <div className="mt-10">
              <MascotQuote bird="magpie" label={d.how.magpieLabel} variant="callout">
                {d.how.magpie}
              </MascotQuote>
            </div>
          </Section>

          <PointsBreakdown locale={locale} />

          {/* Compared with the typical prediction apps — aligned rows, our column highlighted. */}
          <Section id="compare" eyebrow={d.compare.eyebrow} title={d.compare.title} reveal divider>
            <ComparisonTable
              label={d.compare.label}
              topicLabel={d.compare.topic}
              highlight="kachizaka"
              columns={[
                { id: "typical", label: d.compare.typical },
                { id: "kachizaka", label: d.compare.kachizaka },
              ]}
              rows={COMPARE_ROWS.map((id) => ({
                id,
                topic: d.compare.rows[id].topic,
                answers: { typical: d.compare.rows[id].typical, kachizaka: d.compare.rows[id].kachizaka },
              }))}
            />
            <p className="mt-3 text-xs text-fg-muted">
              {d.compare.source}{" "}
              <a className="underline" href={`${REPO_URL}/blob/main/docs/research/market-2026-10.md`}>
                {dict.landing.trust.open.cta}
              </a>
            </p>
          </Section>

          {/* Trust — points only, sealed rules, the code; Orazaka named once, honestly; the status. */}
          <Section id="trust" eyebrow={d.trust.eyebrow} title={d.trust.title} lead={d.trust.lead} reveal divider>
            <CardGrid min={300}>
              {TRUST.map((id) => (
                <LinkCard key={id} layout="stack" href={trustHref[id]} icon={TRUST_ICONS[id]} title={d.trust[id].title} description={d.trust[id].text} cta={d.trust[id].cta} linkAs={Link} />
              ))}
            </CardGrid>
            <MetaRow
              className="mt-6"
              size="md"
              items={[d.trust.powered, "Apache-2.0"]}
              chips={[
                <Badge key="status" tone={status === "preview" ? "accent" : "warning"} title={d.status[status]}>
                  {d.statusChip[status]}
                </Badge>,
              ]}
            />
            <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{d.status[status]}</p>
          </Section>

          <FaqSection locale={locale} />
        </LandingPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
