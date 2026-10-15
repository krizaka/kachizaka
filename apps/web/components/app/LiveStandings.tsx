"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useSay } from "@/lib/i18n-client";
import type { LeagueView } from "@/lib/leagues";

type Row = LeagueView["table"][number];

/**
 * The live table. The rows come from the server (the database is the truth); the league's stream (SSE, @krizaka/realtime)
 * only says "a new version exists" — the page is then refreshed and re-read. While the stream is down the table says
 * so, and stays as it is.
 */
export function LiveStandings({ leagueId, rows, me, version }: { leagueId: string; rows: Row[]; me: string; version: number }) {
  const { say } = useSay();
  const router = useRouter();
  const [live, setLive] = useState(false);
  useEffect(() => {
    const source = new EventSource(`/api/leagues/${leagueId}/events`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as { type?: string; version?: number };
      if (event.type === "match" || (event.type === "standings" && (event.version ?? 0) > version)) router.refresh();
    };
    return () => source.close();
  }, [leagueId, router, version]);
  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { id: "rank", header: say("league.table.rank"), align: "end", sortable: true, value: (r) => r.rank },
      { id: "member", header: say("league.table.member"), card: "title", value: (r) => r.displayName, cell: (r) => (r.memberId === me ? <strong className="font-semibold text-fg">{r.displayName} · {say("league.table.you")}</strong> : r.displayName) },
      { id: "points", header: say("league.table.points"), align: "end", sortable: true, value: (r) => r.points, cell: (r) => <span className="font-mono font-semibold text-fg">{r.points}</span> },
      { id: "exact", header: say("league.table.exact"), align: "end", sortable: true, value: (r) => r.exact },
      { id: "predictions", header: say("league.table.predictions"), align: "end", value: (r) => r.predictions },
    ],
    [say, me],
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-fg-secondary" aria-live="polite">
        <Badge tone={live ? "success" : "neutral"}>{live ? say("league.live") : say("league.offline")}</Badge>
        <span className="font-mono text-xs">{say("league.version", { version })}</span>
      </div>
      <DataTable caption={say("league.table.caption")} showCaption rows={rows} columns={columns} getRowId={(r) => r.memberId} rowLabel={(r) => r.displayName} defaultSort={{ column: "rank", direction: "ascending" }} pageSize={50} />
    </div>
  );
}
