import { inviteLeague } from "@kachizaka/db";
import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";

import { JoinButton } from "@/components/app/JoinButton";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";

/** An invite link: the league's name, and one button. The member layout already requires a session. */
export default async function Join({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const t = getDictionary(locale).console.play.join;
  const league = token.length >= 8 && token.length <= 128 ? await inviteLeague(db(), token, new Date()) : null;
  if (!league) return <Alert tone="warning">{t.invalid}</Alert>;
  return (
    <Card.Root className="flex max-w-xl flex-col gap-4 p-6">
      <h1 className="font-display text-2xl font-bold text-fg">{format(t.title, { league: league.name })}</h1>
      <p className="text-fg-secondary">{t.description}</p>
      <JoinButton token={token} base={`/${locale}/app`} />
    </Card.Root>
  );
}
