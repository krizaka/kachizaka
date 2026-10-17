import { DEFAULT_RULES } from "@kachizaka/core";
import { CheckIcon, KeepIcon, LockIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { ComparisonTable } from "@krizaka/ui/comparison-table";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { MetaRow } from "@krizaka/ui/meta-row";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { LeagueStory } from "@/components/LeagueStory";
import { LeagueView, type LeagueViewText } from "@/components/LeagueView";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { COMPARE_ROWS, productStatus, TRUST } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath, REPO_URL } from "@/lib/site";
import { PLANNED_RULES, type SportId,SPORTS, sportView } from "@/lib/sports";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const VIEWS = SPORTS.map(sportView);

/** The league view's words: every line of points comes from the real scorer (soccer); the others are planned, said so. */
function leagueText(locale: Locale): LeagueViewText {
  const d = getDictionary(locale);
  const t = d.landing.league;
  const names = d.console.league.rules.names;
  const picks: Record<string, string> = {};
  const pts: Record<string, string> = {};
  for (const v of VIEWS) {
    for (const r of v.rows) {
      picks[`${v.sport}:${r.member}`] = format(t.pick, { home: r.pick.home, away: r.pick.away });
      pts[`${v.sport}:${r.member}`] = format(t.pts, { points: r.points ?? 0 });
    }
  }
  const planned = (sport: Exclude<SportId, "soccer">) => PLANNED_RULES[sport].map((id) => (t.rules[sport] as Record<string, string>)[id]);
  const soccerRules = (Object.keys(DEFAULT_RULES) as (keyof typeof DEFAULT_RULES)[])
    .filter((k) => DEFAULT_RULES[k] > 0 && k !== "finalMultiplier")
    .map((k) => `${names[k]} — ${format(t.pts, { points: DEFAULT_RULES[k] })}`);
  return {
    label: t.label, switch: t.switch, sports: t.sports, competitions: t.competitions, match: t.match, final: t.final, table: t.table,
    picks, pts, ready: t.ready, soon: t.soon, unscored: t.unscored, rulesSummary: t.rulesSummary, rulesLead: t.rulesLead,
    rulesPlannedLead: t.rulesPlannedLead, sealLabel: t.sealLabel, note: t.note,
    ruleLines: { soccer: soccerRules, hockey: planned("hockey"), basketball: planned("basketball") },
  };
}

const TRUST_ICONS = { points: <CheckIcon />, sealed: <LockIcon />, open: <KeepIcon /> } as const;

/**
 * dev.kachizaka.com — one story in five sections (lib/landing.ts): the promise and the league as it will look (a sport switch, the real
 * scorer), how it works on a phone, how it compares, why friends can trust it, the closing call. Every block is @krizaka/ui's.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  const dict = getDictionary(locale);
  const story = d.how.phone;
  const soccer = VIEWS[0];
  const trustHref = { points: pagePath(locale, "privacy"), sealed: `${REPO_URL}/tree/main/packages/core`, open: REPO_URL } as const;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        {/* 1 · The promise, and the league as it will look: a sport switch, the real scorer — painted at once (LCP). */}
        <PageHero id="hero" eyebrow={d.eyebrow} title={d.title} lead={d.lead}>
          <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
            <a href={contactHref("dev-kachizaka-hero")}>{d.talk}</a>
          </Button>
          <Button asChild variant="secondary" size="lg" shape="cut">
            <Link href="#how">{d.seeHow}</Link>
          </Button>
          <div className="mt-8 flex basis-full">
            <LeagueView views={VIEWS} text={leagueText(locale)} />
          </div>
        </PageHero>

        {/* 2 · How it works — four steps on a phone; the magpie keeps its promise. */}
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

        {/* 3 · Compared with the typical prediction apps — aligned rows, our column highlighted. */}
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

        {/* 4 · Trust — points only, sealed rules, the code; Orazaka named once, honestly; the status. */}
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

        {/* 5 · The closing call — the one action while sign-up is closed. */}
        <Section id="closing" spacing="sm">
          <CtaPanel title={d.closing.title} body={d.closing.body} reveal>
            <Button asChild variant="primary" size="lg" shape="cut">
              <a href={contactHref("dev-kachizaka-closing")}>{d.talk}</a>
            </Button>
          </CtaPanel>
        </Section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
