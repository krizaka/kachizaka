import { UsersIcon } from "@krizaka/icons";
import { CardGrid } from "@krizaka/ui/card-grid";
import { EmptyState } from "@krizaka/ui/empty-state";
import { LinkCard } from "@krizaka/ui/link-card";
import { Mascot } from "@krizaka/ui/mascots";

import { pageSession } from "@/lib/access";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { leaguesOf } from "@/lib/leagues";

/** The member's leagues — each card opens the league, its sealed rules and its live table. */
export default async function Leagues({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.leagues;
  const session = (await pageSession())!;
  const leagues = await leaguesOf(session.account.id);
  if (!leagues.length) return <EmptyState icon={<Mascot bird="magpie" mood="empty" size={72} />} title={t.emptyTitle} description={t.empty} />;
  return (
    <CardGrid min={260}>
      {leagues.map((l) => (
        <LinkCard key={l.id} layout="stack" href={`/${locale}/app/leagues/${l.id}`} icon={<UsersIcon />} title={l.name} description={format(t.members, { count: l.members })} cta={t.open} />
      ))}
    </CardGrid>
  );
}
