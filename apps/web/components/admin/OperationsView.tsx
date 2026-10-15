"use client";

import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Meter } from "@krizaka/ui/meter";

import type { Operations } from "@/lib/admin-content";
import { useSay } from "@/lib/i18n-client";
import { budgetShare } from "@/lib/operations-shared";

/** What an operator reads to know whether Kachizaka is well: the database budget, the facts pipeline, live matches, the seals. */
export function OperationsView({ ops }: { ops: Operations }) {
  const { say } = useSay();
  const t = (key: string, vars?: Record<string, string | number>) => say(`admin.operations.${key}`, vars);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card.Root className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold text-fg">{t("database")}</h2>
        <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("pool", { busy: ops.pool.total - ops.pool.idle, open: ops.pool.total, max: ops.pool.max })} value={budgetShare(ops.pool.total - ops.pool.idle, ops.pool.max)} max={1} />
        <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("connections", { open: ops.connections.open, limit: ops.connections.limit })} value={budgetShare(ops.connections.open, ops.connections.limit)} max={1} />
        <p className="text-xs text-fg-muted">{t("waiting", { count: ops.pool.waiting })}</p>
      </Card.Root>
      <Card.Root className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold text-fg">{t("pipeline")}</h2>
        <DescriptionList
          items={[
            { term: t("pendingFacts"), details: <Badge tone={ops.facts.pending > 0 ? "danger" : "success"}>{ops.facts.pending}</Badge> },
            { term: t("oldestPending"), details: ops.facts.oldestPendingMinutes === null ? "—" : t("minutes", { count: ops.facts.oldestPendingMinutes }) },
            { term: t("liveMatches"), details: String(ops.live.matches) },
            { term: t("silentMatches"), details: <Badge tone={ops.live.silentMatches > 0 ? "danger" : "success"}>{ops.live.silentMatches}</Badge> },
            { term: t("sealMismatches"), details: <Badge tone={ops.mismatches > 0 ? "danger" : "success"}>{ops.mismatches}</Badge> },
            { term: t("refusedSignIns"), details: <Badge tone={ops.refusedSignIns24h > 10 ? "warning" : "neutral"}>{ops.refusedSignIns24h}</Badge> },
          ]}
        />
      </Card.Root>
    </div>
  );
}
