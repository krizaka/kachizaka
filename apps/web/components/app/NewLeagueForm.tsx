"use client";

import { COMPETITION_IDS } from "@kachizaka/core";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const created = z.object({ id: z.string() });
const FIELDS = { NHL: "nhl", "Premier League": "premierLeague", "Ligue 1": "ligue1" } as const;
const league = createKrizakaForm({
  schema: z.object({ name: z.string().trim().min(2).max(60), nhl: z.boolean(), premierLeague: z.boolean(), ligue1: z.boolean() }),
  defaultValues: { name: "", nhl: true, premierLeague: true, ligue1: false },
});

/** Start a league: a name and the competitions it follows — then straight to its page, where the invite link is. */
export function NewLeagueForm({ base }: { base: string }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const create = useMutation({ mutationFn: (json: { name: string; competitions: string[] }) => krizakaFetch("/api/leagues", { method: "POST", json, schema: created }) });
  const form = league.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (v) => {
      setProblem(null);
      const competitions = COMPETITION_IDS.filter((c) => v[FIELDS[c]]);
      if (!competitions.length) return setProblem(say("play.new.none"));
      try {
        const { id } = await create.mutateAsync({ name: v.name, competitions });
        router.push(`${base}/leagues/${id}`);
        router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("play.new.title")} className="flex max-w-xl flex-col gap-5">
      <form.TextField name="name" label={say("play.new.name")} placeholder={say("play.new.namePlaceholder")} autoComplete="off" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">{say("play.new.competitions")}</legend>
        {COMPETITION_IDS.map((c) => (
          <form.Checkbox key={c} name={FIELDS[c]} label={say(`play.new.competitionNames.${c}`)} />
        ))}
      </fieldset>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit size="lg" shape="cut">
        {say("play.new.submit")}
      </form.Submit>
    </form.Form>
  );
}
