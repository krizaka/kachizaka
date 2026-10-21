"use client";

import { ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Tabs } from "@krizaka/ui/tabs";

import { SportIcon } from "@/components/SportIcon";
import type { LeagueSportView } from "@/lib/league-view";
import { SPORTS } from "@/lib/sports";

export interface LeagueViewText {
  label: string;
  switch: string;
  sports: Record<(typeof SPORTS)[number], string>;
  competitions: string;
  resultsTitle: string;
  noResults: string;
  final: string;
  overtime: string;
  table: string;
  ready: string;
  soon: string;
  soonWhy: string;
  rulesSummary: string;
  rulesLead: string;
  rulesPlannedLead: string;
  sealLabel: string;
  /** The rule lines of each sport, already named and worth: from the scorer's rules, basketball planned. */
  ruleLines: Record<(typeof SPORTS)[number], string[]>;
  /** « Table updated … », or null for the example. */
  updated: string | null;
  note: string;
}

/**
 * The league as a visitor sees it: a sport switch (the family's Tabs, icons from @krizaka/icons), the sport's table, its
 * last results with every friend's pick and the points the real scorer gave it, and the sealed rules behind a plain « Rules
 * sealed » — the hash is in the details, never on the hero. Everything is read from props: the server worded it, from the
 * database (lib/league-view.ts).
 */
export function LeagueView({ views, text, bare = false }: { views: readonly LeagueSportView[]; text: LeagueViewText; bare?: boolean }) {
  return (
    <figure className="m-0 flex w-full flex-col gap-2" aria-label={text.label}>
      <Tabs.Root defaultValue="soccer" variant="segmented" className={bare ? "overflow-hidden bg-surface-0" : "overflow-hidden rounded-2xl border border-border-default bg-surface-0 shadow-2xl"}>
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
              <span className="text-xs text-fg-muted">{v.ready ? text.updated : text.soonWhy}</span>
              <Badge tone={v.ready ? "success" : "warning"}>{v.ready ? text.ready : text.soon}</Badge>
            </div>
            {v.ready && (
              <ol className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default bg-surface-1" aria-label={text.table}>
                {v.table.map((r, i) => (
                  <li key={r.member} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 font-mono text-xs text-fg-muted">{i + 1}</span>
                    <span className="flex-1 font-medium text-fg">{r.member}</span>
                    <span className="w-16 text-right font-mono text-xs font-semibold text-fg">{r.pts}</span>
                  </li>
                ))}
              </ol>
            )}
            {v.ready && (
              <section aria-label={text.resultsTitle} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-fg-muted">{text.resultsTitle}</h3>
                {v.results.length === 0 && <p className="text-fg-secondary">{text.noResults}</p>}
                <ul className="flex flex-col gap-2">
                  {v.results.map((r) => (
                    <li key={r.title} className="rounded-lg border border-border-default bg-surface-1 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-fg">{r.title}</span>
                        <span className="flex items-center gap-2 text-xs text-fg-muted">
                          {r.meta}
                          {r.overtime && <Badge tone="neutral">{text.overtime}</Badge>}
                          <Badge tone="neutral">{text.final}</Badge>
                        </span>
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-fg-secondary">
                        {r.picks.map((p) => (
                          <li key={p.member}>
                            <span className="text-fg">{p.member}</span> {p.pick} {p.pts && <span className="font-semibold text-fg">{p.pts}</span>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-fg-muted">
              {text.competitions} : {v.competitions.join(" · ")}
            </p>
            <details className="rounded-lg border border-border-default bg-surface-1 px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-fg">
                <ShieldIcon size={16} aria-hidden /> {text.rulesSummary}
              </summary>
              <p className="mt-2 text-fg-secondary">{v.ready ? text.rulesLead : text.rulesPlannedLead}</p>
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
      <figcaption className={bare ? "px-4 pb-3 text-xs text-fg-muted" : "text-xs text-fg-muted"}>{text.note}</figcaption>
    </figure>
  );
}
