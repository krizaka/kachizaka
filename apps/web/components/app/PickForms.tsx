"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Badge } from "@krizaka/ui/badge";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/** The pick forms of the league page, one per kind of pick (a score, a score and « overtime », a winner and a band). */
export interface PickTarget {
  leagueId: string;
  matchId: string;
  sport: "soccer" | "hockey" | "basketball";
  home: string;
  away: string;
  /** What the member already picked, as form strings. */
  initial?: { home?: number | null; away?: number | null; overtime?: boolean; winner?: "home" | "away" | null; band?: number | null };
  /** Basketball: the words of each band (« 1 to 5 points »…), in order. */
  bands: string[];
}

const goal = z.string().regex(/^\d{1,2}$/, "form.errors.invalidNumber");
const score = createKrizakaForm({ schema: z.object({ home: goal, away: goal, overtime: z.boolean() }), defaultValues: { home: "", away: "", overtime: false } });
const winnerBand = createKrizakaForm({ schema: z.object({ winner: z.enum(["home", "away"]), band: z.string() }), defaultValues: { winner: "home", band: "0" } });

function useSave(target: PickTarget) {
  const router = useRouter();
  const { say } = useSay();
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const request = useMutation({ mutationFn: (pick: Record<string, unknown>) => krizakaFetch(`/api/leagues/${target.leagueId}/picks`, { method: "PUT", json: { matchId: target.matchId, pick } }) });
  const save = async (pick: Record<string, unknown>) => {
    setProblem(null);
    setSaved(false);
    try {
      await request.mutateAsync(pick);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  return { saved, problem, save };
}

const Result = ({ saved, problem }: { saved: boolean; problem: string | null }) => {
  const { say } = useSay();
  return (
    <div aria-live="polite" className="min-h-5 text-sm">
      {saved ? <Badge tone="success">{say("league.picks.saved")}</Badge> : null}
      {problem ? <span className="text-fg-danger">{problem}</span> : null}
    </div>
  );
};

/** Soccer and hockey: two numbers, and for hockey « overtime or shootout ». */
export function ScorePick({ target }: { target: PickTarget }) {
  const { say, locale } = useSay();
  const { saved, problem, save } = useSave(target);
  const hockey = target.sport === "hockey";
  const form = score.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { home: target.initial?.home?.toString() ?? "", away: target.initial?.away?.toString() ?? "", overtime: !!target.initial?.overtime },
    onSubmit: async (v) => save({ home: Number(v.home), away: Number(v.away), ...(hockey ? { overtime: v.overtime } : {}) }),
  });
  const had = target.initial?.home != null;
  return (
    <form.Form aria-label={`${target.home} – ${target.away}`} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <form.TextField name="home" label={say("league.picks.home", { team: target.home })} inputMode="numeric" maxLength={2} autoComplete="off" />
        <form.TextField name="away" label={say("league.picks.away", { team: target.away })} inputMode="numeric" maxLength={2} autoComplete="off" />
      </div>
      {hockey ? <form.Checkbox name="overtime" label={say("league.picks.overtime")} /> : null}
      <div className="flex items-center gap-3">
        <form.Submit size="md" shape="cut" variant={had ? "secondary" : "primary"}>
          {had ? say("league.picks.update") : say("league.picks.save")}
        </form.Submit>
        <Result saved={saved} problem={problem} />
      </div>
    </form.Form>
  );
}

/** Basketball: who wins, and by how much (the league's margin bands). */
export function WinnerBandPick({ target }: { target: PickTarget }) {
  const { say, locale } = useSay();
  const { saved, problem, save } = useSave(target);
  const form = winnerBand.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { winner: target.initial?.winner ?? "home", band: String(target.initial?.band ?? 0) },
    onSubmit: async (v) => save({ winner: v.winner, band: Number(v.band) }),
  });
  const had = target.initial?.winner != null;
  return (
    <form.Form aria-label={`${target.home} – ${target.away}`} className="flex flex-col gap-3">
      <form.RadioGroup
        name="winner"
        label={say("league.picks.winner")}
        variant="segmented"
        orientation="horizontal"
        options={[
          { value: "home", label: target.home },
          { value: "away", label: target.away },
        ]}
      />
      <form.Select name="band" label={say("league.picks.band")} options={target.bands.map((label, i) => ({ value: String(i), label }))} />
      <div className="flex items-center gap-3">
        <form.Submit size="md" shape="cut" variant={had ? "secondary" : "primary"}>
          {had ? say("league.picks.update") : say("league.picks.save")}
        </form.Submit>
        <Result saved={saved} problem={problem} />
      </div>
    </form.Form>
  );
}
