import { DEFAULT_RULES } from "@kachizaka/core";
import { NumberTicker } from "@krizaka/ui/number-ticker";
import { Section } from "@krizaka/ui/page";

import { format, getDictionary, type Locale } from "@/lib/i18n";
import { POINT_RULES } from "@/lib/landing";

/**
 * « Comment un pronostic rapporte des points »: one card per rule worth points, the value counted from the real scorer's
 * defaults (`@kachizaka/core`, never typed), then the final's multiplier and the worked example of the hero's table.
 */
export function PointsBreakdown({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.points;
  return (
    <Section id="points" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3" data-testid="points-rules">
        {POINT_RULES.map((r, i) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-border-default bg-surface-1 p-5" data-reveal={i}>
            <p className="m-0 flex items-baseline gap-1.5 text-fg">
              <span className="text-4xl font-bold tracking-tight text-fg-accent">
                <NumberTicker value={r.points} locale={locale} />
              </span>
              <span className="font-mono text-sm text-fg-muted">{t.pts}</span>
            </p>
            <p className="m-0 text-base font-semibold text-fg">{t.items[r.id].title}</p>
            <p className="m-0 text-sm leading-relaxed text-fg-secondary">{t.items[r.id].text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 mb-0 max-w-[70ch] text-sm leading-relaxed text-fg-secondary">{format(t.final, { factor: DEFAULT_RULES.finalMultiplier })}</p>
    </Section>
  );
}
