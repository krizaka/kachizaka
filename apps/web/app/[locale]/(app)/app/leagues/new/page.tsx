import { NewLeagueForm } from "@/components/app/NewLeagueForm";
import { asLocale, getDictionary } from "@/lib/i18n";

/** Start a league: a name and the competitions it follows. */
export default async function NewLeague({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.play.new;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
        <p className="max-w-2xl text-fg-secondary">{t.description}</p>
      </header>
      <NewLeagueForm base={`/${locale}/app`} />
    </div>
  );
}
