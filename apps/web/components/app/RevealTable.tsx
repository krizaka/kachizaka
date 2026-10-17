"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { useMemo } from "react";

export interface RevealRow {
  id: string;
  name: string;
  me: boolean;
  pick: string;
  points: number | null;
  why: string;
  perfect: boolean;
}

export interface RevealText {
  caption: string;
  member: string;
  pick: string;
  points: string;
  why: string;
  perfect: string;
  you: string;
  none: string;
}

/** What everyone picked for a game that has started, the points and the rules that earned them (the table of the family). */
export function RevealTable({ rows, text }: { rows: RevealRow[]; text: RevealText }) {
  const columns = useMemo<DataTableColumn<RevealRow>[]>(
    () => [
      { id: "name", header: text.member, card: "title", value: (r) => r.name, cell: (r) => (r.me ? <strong className="font-semibold text-fg">{r.name} · {text.you}</strong> : r.name) },
      { id: "pick", header: text.pick, value: (r) => r.pick, cell: (r) => <span className="font-mono text-xs">{r.pick}</span> },
      { id: "points", header: text.points, align: "end", sortable: true, value: (r) => r.points ?? -1, cell: (r) => <span className="font-mono font-semibold text-fg">{r.points ?? "—"}</span> },
      { id: "why", header: text.why, value: (r) => r.why, cell: (r) => (r.perfect ? <span className="flex flex-wrap items-center gap-2">{r.why}<Badge tone="success">{text.perfect}</Badge></span> : r.why) },
    ],
    [text],
  );
  return <DataTable caption={text.caption} rows={rows} columns={columns} getRowId={(r) => r.id} rowLabel={(r) => r.name} pageSize={20} />;
}
