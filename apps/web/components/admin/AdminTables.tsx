"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn,DataTableColumnsMenu, DataTableExport, DataTableFilters } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import type { AdminUser, AuditEntry } from "@/lib/admin";
import type { AdminLeague, AdminMatch, AdminRuleSet } from "@/lib/admin-content";
import { useSay } from "@/lib/i18n-client";

import { formatDate } from "./format";

const toolbar = (filename: string) => (
  <div className="flex flex-col gap-3">
    <DataTableFilters />
    <div className="flex justify-end gap-2">
      <DataTableColumnsMenu />
      <DataTableExport filename={filename} />
    </div>
  </div>
);

/** The accounts: who, role, state, memberships, last seen; searchable, filterable, exportable. */
export function UsersTable({ users }: { users: AdminUser[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminUser>[]>(
    () => [
      { id: "email", header: say("admin.columns.email"), sortable: true, filter: "text", card: "title", cell: (u) => <Link className="font-semibold text-fg hover:text-fg-accent hover:underline" href={`/${locale}/users/${u.id}`}>{u.email}</Link> },
      { id: "role", header: say("admin.columns.role"), filter: "facet", cell: (u) => <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>{say(`admin.roles.${u.role}`)}</Badge> },
      { id: "status", header: say("admin.columns.status"), filter: "facet", cell: (u) => <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{say(`admin.states.${u.status}`)}</Badge> },
      { id: "memberships", header: say("admin.columns.memberships"), sortable: true, align: "end" },
      { id: "lastSeenAt", header: say("admin.columns.lastSeen"), sortable: true, align: "end", value: (u) => u.lastSeenAt ?? "", cell: (u) => (u.lastSeenAt ? formatDate(u.lastSeenAt, locale, true) : say("admin.never")) },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.users.caption")} rows={users} columns={columns} getRowId={(u) => u.id} rowLabel={(u) => u.email} defaultPageSize={25} defaultSort={{ column: "lastSeenAt", direction: "descending" }} toolbar={toolbar("kachizaka-users.csv")} />;
}

export function LeaguesTable({ leagues }: { leagues: AdminLeague[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminLeague>[]>(
    () => [
      { id: "name", header: say("admin.columns.league"), sortable: true, filter: "text", card: "title" },
      { id: "owner", header: say("admin.columns.owner"), value: (l) => l.owner ?? "", cell: (l) => l.owner ?? say("admin.never") },
      { id: "members", header: say("admin.columns.members"), sortable: true, align: "end" },
      { id: "seasons", header: say("admin.columns.seasons"), sortable: true, align: "end" },
      { id: "matches", header: say("admin.columns.matches"), sortable: true, align: "end" },
      { id: "createdAt", header: say("admin.columns.created"), sortable: true, cell: (l) => formatDate(l.createdAt, locale) },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.leaguesList.caption")} rows={leagues} columns={columns} getRowId={(l) => l.id} defaultPageSize={25} toolbar={toolbar("kachizaka-leagues.csv")} />;
}

const MATCH_TONE = { scheduled: "neutral", live: "accent", final: "success" } as const;

/** Matches with their state, the seal they kicked off with, and the facts still waiting to be applied. */
export function MatchesTable({ matches }: { matches: AdminMatch[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminMatch>[]>(
    () => [
      { id: "fixture", header: say("admin.columns.match"), sortable: true, filter: "text", card: "title" },
      { id: "league", header: say("admin.columns.league"), filter: "facet" },
      { id: "kickoffAt", header: say("admin.columns.kickoff"), sortable: true, cell: (m) => formatDate(m.kickoffAt, locale, true) },
      { id: "status", header: say("admin.columns.status"), filter: "facet", cell: (m) => <Badge tone={MATCH_TONE[m.status]}>{say(`admin.matchStates.${m.status}`)}</Badge> },
      { id: "score", header: say("admin.columns.score"), align: "end" },
      { id: "pendingFacts", header: say("admin.columns.pendingFacts"), sortable: true, align: "end", cell: (m) => <Badge tone={m.pendingFacts > 0 ? "danger" : "neutral"}>{m.pendingFacts}</Badge> },
      { id: "predictions", header: say("admin.columns.predictions"), sortable: true, align: "end" },
      { id: "seal", header: say("admin.columns.seal"), value: (m) => m.seal ?? "", cell: (m) => <code className="font-mono text-[11px]">{m.seal ? m.seal.slice(0, 15) : "—"}</code> },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.matches.caption")} rows={matches} columns={columns} getRowId={(m) => m.id} defaultPageSize={25} defaultSort={{ column: "kickoffAt", direction: "descending" }} toolbar={toolbar("kachizaka-matches.csv")} />;
}

/** The scoring rules by league and version, sealed or not, and how many matches kicked off under each. */
export function RuleSetsTable({ ruleSets }: { ruleSets: AdminRuleSet[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminRuleSet>[]>(
    () => [
      { id: "league", header: say("admin.columns.league"), sortable: true, filter: "facet", card: "title" },
      { id: "version", header: say("admin.columns.version"), sortable: true, align: "end" },
      { id: "sealedAt", header: say("admin.columns.sealed"), value: (r) => (r.sealedAt ? "sealed" : "open"), cell: (r) => <Badge tone={r.sealedAt ? "success" : "neutral"}>{r.sealedAt ? say("admin.sealed", { date: formatDate(r.sealedAt, locale) }) : say("admin.notSealed")}</Badge> },
      { id: "matchesUsing", header: say("admin.columns.matchesUsing"), sortable: true, align: "end" },
      { id: "seal", header: say("admin.columns.seal"), cell: (r) => <code className="font-mono text-[11px]">{r.seal.slice(0, 23)}…</code> },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.rules.caption")} rows={ruleSets} columns={columns} getRowId={(r) => r.id} defaultPageSize={25} toolbar={toolbar("kachizaka-rule-sets.csv")} />;
}

/** The audit log: sortable, filterable by action, exportable. */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      { id: "at", header: say("admin.columns.when"), sortable: true, cell: (e) => formatDate(e.at, locale, true) },
      { id: "actor", header: say("admin.columns.actor"), filter: "text" },
      { id: "action", header: say("admin.columns.action"), filter: "facet", card: "title", cell: (e) => <span className="font-mono text-xs">{e.action}</span> },
      { id: "target", header: say("admin.columns.target"), value: (e) => e.target ?? "", cell: (e) => <span className="font-mono text-[11px]">{e.target ?? "—"}</span> },
      { id: "ip", header: say("admin.columns.ip"), value: (e) => e.ip ?? "", cell: (e) => e.ip ?? "—" },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.audit.caption")} rows={entries} columns={columns} getRowId={(e) => e.id} defaultPageSize={25} toolbar={toolbar("kachizaka-audit.csv")} />;
}
