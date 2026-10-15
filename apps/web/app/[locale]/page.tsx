import { DEFAULT_RULES, scorePrediction, sealOf } from "@kachizaka/core";
import { ClockIcon, ShieldIcon, UsersIcon } from "@krizaka/icons";
import { KachizakaLogo } from "@krizaka/ui";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LinkCard } from "@krizaka/ui/link-card";
import { Mascot } from "@krizaka/ui/mascots";
import { Section } from "@krizaka/ui/page";
import { ProductPage } from "@krizaka/ui/product-page";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary, type Locale, translator } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref } from "@/lib/site";

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

/** dev.kachizaka.com: what Kachizaka does and how — the product page template of @krizaka/ui, in cobalt and gold. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = translator(locale);
  const d = getDictionary(locale).landing;
  const signIn = `/${locale}/sign-in`;
  const steps = [
    { id: "sealed", href: "#sealed", icon: <ShieldIcon /> },
    { id: "live", href: "#live", icon: <ClockIcon /> },
    { id: "memory", href: "#memory", icon: <UsersIcon /> },
  ] as const;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content" className="pt-20">
        <ProductPage
          brand="kachizaka"
          linkAs={Link}
          mark={
            <>
              <KachizakaLogo size={18} animated={false} /> {d.mark}
            </>
          }
          title={d.title}
          lead={d.lead}
          facts={[{ label: d.facts.points, tone: "ok" }, { label: d.facts.license }, { label: d.facts.closed, tone: "wip" }]}
          actions={
            <>
              <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
                <a href={contactHref("dev-kachizaka-hero")}>{d.talk}</a>
              </Button>
              <Button asChild variant="secondary" size="lg" shape="cut">
                <Link href={signIn}>{d.signIn}</Link>
              </Button>
            </>
          }
          visualLabel={d.visualLabel}
          visual={<Visual locale={locale} />}
          reasonsHeading={{ eyebrow: d.reasonsEyebrow, title: d.reasonsTitle }}
          reasonLabels={{ trap: d.trap, more: d.more }}
          reasons={(["sealed", "live", "memory"] as const).map((id) => ({ id, title: d.reasons[id].title, trap: d.reasons[id].trap, mark: <Mascot bird="magpie" size={40} animated={false} />, href: `#${id}` }))}
          decisions={{ eyebrow: d.decisionsEyebrow, title: d.decisionsTitle, labels: d.decisionLabels, items: (["points", "seal", "feed"] as const).map((id) => ({ id, ...d.decisions[id] })) }}
          promise={{ bird: "magpie", label: d.promiseLabel, text: d.promise }}
          closing={{
            title: d.closingTitle,
            body: d.closingBody,
            actions: (
              <Button asChild variant="primary" size="lg" shape="cut">
                <a href={contactHref("dev-kachizaka-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          <Section id="how" eyebrow={d.sections.how.eyebrow} title={d.sections.how.title} lead={d.sections.how.lead} divider>
            <CardGrid min={240}>
              {steps.map((s) => (
                <LinkCard key={s.id} layout="stack" href={s.href} icon={s.icon} title={t(`landing.sections.how.steps.${s.id}.title`)} description={t(`landing.sections.how.steps.${s.id}.text`)} cta={d.more} />
              ))}
            </CardGrid>
          </Section>
          <Section id="account" eyebrow={d.sections.account.eyebrow} title={d.sections.account.title} lead={d.sections.account.lead} divider actions={<Button asChild variant="secondary" size="md" shape="cut"><Link href={`/${locale}/forgot-password`}>{d.sections.account.forgot}</Link></Button>}>
            <ul className="grid max-w-3xl gap-2 text-fg-secondary">
              {d.sections.account.points.map((p) => (
                <li key={p} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
                  {p}
                </li>
              ))}
            </ul>
          </Section>
          {(["sealed", "live", "memory"] as const).map((id) => (
            <Section key={id} id={id} eyebrow={d.sections[id].eyebrow} title={d.sections[id].title} lead={d.sections[id].lead} divider actions={<Button asChild variant="secondary" size="md" shape="cut"><Link href={signIn}>{d.signIn}</Link></Button>}>
              <ul className="grid max-w-3xl gap-2 text-fg-secondary">
                {d.sections[id].points.map((p) => (
                  <li key={p} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
                    {p}
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </ProductPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
