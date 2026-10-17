"use client";

import { ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Tabs } from "@krizaka/ui/tabs";

import { SportIcon } from "@/components/SportIcon";
import type { SportView } from "@/lib/sports";
import { SPORTS } from "@/lib/sports";

export interface LeagueViewText {
  label: string;
  switch: string;
  sports: Record<(typeof SPORTS)[number], string>;
  competitions: string;
  match: string;
  final: string;
  table: string;
  /** `{home} – {away}` already formatted per row by the server: member → text. */
  picks: Record<string, string>;
  pts: Record<string, string>;
  ready: string;
  soon: string;
  unscored: string;
  rulesSummary: string;
  rulesLead: string;
  rulesPlannedLead: string;
  sealLabel: string;
  /** The rule lines of each sport, already named and worth: soccer from the scorer's rules, the others planned. */
  ruleLines: Record<(typeof SPORTS)[number], string[]>;
  note: string;
}

/**
 * The league as a visitor will see it: a sport switch (the family's Tabs, icons from @krizaka/icons), the match, each
 * friend's pick with the points the real scorer gave it, and the sealed rules behind a plain « Rules sealed » — the
 * hash is in the details, never on the hero. Everything is read from props: the server computed it.
 */
export function LeagueView({ views, text }: { views: readonly SportView[]; text: LeagueViewText }) {
  return (
    <figure className="m-0 flex w-full max-w-2xl flex-col gap-2" aria-label={text.label}>
      <Tabs.Root defaultValue="soccer" variant="segmented" className="overflow-hidden rounded-2xl border border-border-default bg-surface-0 shadow-2xl">
        <div className="border-b border-border-default bg-surface-1 p-3">
          <Tabs.List aria-label={text.switch}>
            {views.map((v) => (
              <Tabs.Trigger key={v.sport} value={v.sport} className="gap-2">
                <SportIcon sport={v.sport} />
                {text.sports[v.sport]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
        {views.map((v) => (
          <Tabs.Content key={v.sport} value={v.sport} className="flex flex-col gap-4 p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs text-fg-muted">{text.match}</span>
                <span className="text-base font-semibold text-fg">
                  {v.match.home} {v.match.actual.home} – {v.match.actual.away} {v.match.away}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{text.final}</Badge>
                <Badge tone={v.status === "ready" ? "success" : "warning"}>{v.status === "ready" ? text.ready : text.soon}</Badge>
              </div>
            </div>
            <ol className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default bg-surface-1" aria-label={text.table}>
              {v.rows.map((r, i) => (
                <li key={r.member} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 font-mono text-xs text-fg-muted">{v.status === "ready" ? i + 1 : "·"}</span>
                  <span className="flex-1 font-medium text-fg">{r.member}</span>
                  <span className="font-mono text-xs text-fg-secondary">{text.picks[`${v.sport}:${r.member}`]}</span>
                  <span className="w-14 text-right font-mono text-xs font-semibold text-fg">{r.points === null ? "—" : text.pts[`${v.sport}:${r.member}`]}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-fg-muted">
              {text.competitions} : {v.competitions.join(" · ")}
            </p>
            <details className="rounded-lg border border-border-default bg-surface-1 px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-fg">
                <ShieldIcon size={16} aria-hidden /> {text.rulesSummary}
              </summary>
              <p className="mt-2 text-fg-secondary">{v.status === "ready" ? text.rulesLead : text.rulesPlannedLead}</p>
              <ul className="mt-2 flex flex-col gap-1 text-fg">
                {text.ruleLines[v.sport].map((line) => (
                  <li key={line} className="font-mono text-xs">
                    {line}
                  </li>
                ))}
              </ul>
              {v.seal && (
                <p className="mt-3 break-all text-xs text-fg-muted">
                  {text.sealLabel} : <span className="font-mono">{v.seal}</span>
                </p>
              )}
            </details>
          </Tabs.Content>
        ))}
      </Tabs.Root>
      <figcaption className="text-xs text-fg-muted">{text.note}</figcaption>
    </figure>
  );
}
