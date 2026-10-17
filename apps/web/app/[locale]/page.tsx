import { DEFAULT_RULES, scorePrediction, sealOf } from "@kachizaka/core";
import { CheckIcon, ClockIcon, KeepIcon, LockIcon, ShieldIcon, UsersIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { MetaRow } from "@krizaka/ui/meta-row";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { HOW_STEPS, OUTCOMES, productStatus, TRUST } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath, REPO_URL } from "@/lib/site";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

/** The example on the page, computed by the real scorer of @kachizaka/core with the default rules — never typed by hand. */
const EXAMPLE = { predicted: { home: 3, away: 2 }, actual: { home: 2, away: 1 } };
const EXAMPLE_SCORE = scorePrediction(DEFAULT_RULES, EXAMPLE.predicted, EXAMPLE.actual);
const EXAMPLE_SEAL = sealOf(DEFAULT_RULES);

function Visual({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.visual;
  const names = getDictionary(locale).console.league.rules.names;
  return (
    <div className="flex flex-col gap-3 p-5 text-sm">
      <div className="rounded-lg border border-border-default bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-fg">{t.match}</span>
          <Badge tone="success">{t.final}</Badge>
        </div>
        <p className="mt-2 text-fg-secondary">{format(t.predicted, { home: EXAMPLE.predicted.home, away: EXAMPLE.predicted.away })}</p>
        <ul className="mt-2 flex flex-col gap-1" aria-label={t.breakdown}>
          {EXAMPLE_SCORE.breakdown.map((l) => (
            <li key={l.rule} className="flex justify-between gap-2 font-mono text-xs text-fg">
              <span>{names[l.rule]}</span>
              <span>+{l.points}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 border-t border-border-default pt-1 font-mono text-xs font-semibold text-fg">
            <span>{t.total}</span>
            <span>{EXAMPLE_SCORE.points}</span>
          </li>
        </ul>
      </div>
      <div className="rounded-lg border border-border-default bg-surface-1 p-4">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <ShieldIcon size={16} aria-hidden /> {t.sealed}
        </p>
        <p className="mt-1 break-all font-mono text-xs text-fg-muted">{EXAMPLE_SEAL}</p>
      </div>
      <p className="text-xs text-fg-muted">{t.note}</p>
    </div>
  );
}

const OUTCOME_ICONS = { settle: <UsersIcon />, fair: <ShieldIcon />, memory: <KeepIcon /> } as const;
const HOW_ICONS = { league: <UsersIcon />, predict: <ClockIcon />, table: <CheckIcon /> } as const;
const TRUST_ICONS = { points: <CheckIcon />, sealed: <LockIcon />, open: <KeepIcon /> } as const;

/**
 * dev.kachizaka.com — one story in five sections (lib/landing.ts): the promise and a prediction scored by the product's
 * own code, what friends can do, how it works, why they can trust it, the closing call. Every block is @krizaka/ui's.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  const signIn = `/${locale}/sign-in`;
  const trustHref = { points: pagePath(locale, "privacy"), sealed: `${REPO_URL}/tree/main/packages/core`, open: REPO_URL } as const;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        {/* 1 · The promise, and its proof: a prediction scored by the real scorer — painted at once (LCP), never revealed. */}
        <PageHero id="hero" eyebrow={d.eyebrow} title={d.title} lead={d.lead}>
          <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
            <a href={contactHref("dev-kachizaka-hero")}>{d.talk}</a>
          </Button>
          <Button asChild variant="secondary" size="lg" shape="cut">
            <Link href="#how">{d.seeHow}</Link>
          </Button>
          <figure className="m-0 mt-8 flex basis-full flex-col gap-2" aria-label={d.proof.label}>
            <div className="max-w-md overflow-hidden rounded-2xl border border-border-default bg-surface-0 shadow-2xl">
              <Visual locale={locale} />
            </div>
            <figcaption className="max-w-md text-xs text-fg-muted">{d.proof.caption}</figcaption>
          </figure>
        </PageHero>

        {/* 2 · What friends can do — outcomes, each card a way in. */}
        <Section id="outcomes" eyebrow={d.outcomes.eyebrow} title={d.outcomes.title} reveal divider>
          <CardGrid min={300}>
            {OUTCOMES.map((o) => (
              <LinkCard key={o.id} layout="stack" href={signIn} icon={OUTCOME_ICONS[o.id]} title={d.outcomes[o.id].title} description={d.outcomes[o.id].text} cta={d.outcomes[o.id].cta} linkAs={Link} />
            ))}
          </CardGrid>
        </Section>

        {/* 3 · How it works — three steps; the magpie keeps its promise. */}
        <Section id="how" eyebrow={d.how.eyebrow} title={d.how.title} lead={d.how.lead} reveal divider>
          <ol className="grid gap-4 md:grid-cols-3">
            {HOW_STEPS.map((id, i) => (
              <li key={id} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-5" data-reveal="">
                <span className="flex items-center gap-3 text-fg-accent">
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="[&_svg]:h-5 [&_svg]:w-5">
                    {HOW_ICONS[id]}
                  </span>
                </span>
                <h3 className="text-base font-semibold text-fg">{d.how.steps[id].title}</h3>
                <p className="text-sm leading-relaxed text-fg-secondary">{d.how.steps[id].text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <MascotQuote bird="magpie" label={d.how.magpieLabel} variant="callout">
              {d.how.magpie}
            </MascotQuote>
          </div>
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
