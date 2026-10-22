import { contrast, EMBLEM_IDS, PAIRS, TeamCrest } from "@kachizaka/design-system";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { MATRIX, MATRIX_TEAM, SPECIMEN_SIZES, SPECIMEN_TEAMS } from "@/lib/design-specimen";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

/** The tokens' two pages, surface-0 (dark `hsl(150 12% 9.5%)`, light `hsl(100 14% 96%)`), for the ratios the table prints. */
const DARK = "#151B18";
const LIGHT = "#F4F6F2";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "design");
}

/** `/design` (docs-article template): Kachizaka's crest system as a specimen plate — the design system's own documentation. */
export default async function Design({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).design;
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="design" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} eyebrow={d.eyebrow} title={d.title} lead={d.lead} />
        <Section title={d.familyTitle} lead={d.familyLead}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-6" aria-label={d.familyTitle}>
            {SPECIMEN_TEAMS.map((name, i) => (
              <li key={name} className="flex flex-col items-center gap-2 text-center" data-reveal={i % 6}>
                <TeamCrest name={name} size={88} />
                <span className="font-mono text-xs text-fg-secondary">{name}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={d.sizesTitle} lead={d.sizesLead}>
          <ul className="flex flex-wrap items-end gap-6" aria-label={d.sizesTitle}>
            {SPECIMEN_SIZES.map((px) => (
              <li key={px} className="flex flex-col items-center gap-2">
                <TeamCrest name={MATRIX_TEAM} size={px} />
                <span className="font-mono text-xs text-fg-muted">{px}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={d.shapesTitle} lead={d.shapesLead}>
          <ul className="grid grid-cols-4 gap-4 sm:grid-cols-8" aria-label={d.shapesTitle}>
            {MATRIX.map(({ shape, layout }) => (
              <li key={`${shape}-${layout}`} className="flex flex-col items-center gap-1 text-center">
                <TeamCrest name={MATRIX_TEAM} size={56} shape={shape} layout={layout} />
                <span className="font-mono text-[11px] text-fg-muted">{shape}<br />{layout}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={d.inksTitle} lead={d.inksLead}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={d.inksTitle}>
            {PAIRS.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 p-3">
                <TeamCrest name={p.id} size={40} main={p.main} secondary={p.secondary} />
                <span className="flex flex-col font-mono text-xs text-fg-secondary">
                  <span className="text-fg">{p.id}</span>
                  <span>{contrast(p.main, DARK).toFixed(1)} {d.contrastDark} · {contrast(p.main, LIGHT).toFixed(1)} {d.contrastLight}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={d.emblemsTitle} lead={d.emblemsLead}>
          <ul className="flex flex-wrap gap-5" aria-label={d.emblemsTitle}>
            {EMBLEM_IDS.map((id) => (
              <li key={id} className="flex flex-col items-center gap-1">
                <TeamCrest name={`${MATRIX_TEAM} ${id}`} size={56} emblem={id} layout="plain" />
                <span className="font-mono text-xs text-fg-muted">{id}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={d.motionTitle} lead={d.motionLead}>
          <ul className="flex flex-wrap gap-8" aria-label={d.motionTitle}>
            <li className="flex flex-col items-center gap-2">
              <TeamCrest name="Harfangs" size={96} settle />
              <span className="font-mono text-xs text-fg-muted">{d.settle}</span>
            </li>
            <li className="flex flex-col items-center gap-2">
              <TeamCrest name="Harfangs" size={96} winner />
              <span className="font-mono text-xs text-fg-muted">{d.winner}</span>
            </li>
          </ul>
        </Section>
        <Section title={d.rulesTitle}>
          <ul className="flex max-w-3xl list-disc flex-col gap-2 pl-5 text-fg-secondary">
            <li>{d.rules.a}</li>
            <li>{d.rules.b}</li>
            <li>{d.rules.c}</li>
            <li>{d.rules.d}</li>
          </ul>
        </Section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
