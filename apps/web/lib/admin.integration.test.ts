import { seedDemoLeague } from "@kachizaka/db/seed";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLog, deleteAccount, exportAccount, listUsers, revokeUserSessions, setUserRole, setUserStatus, userDetail } from "./admin";
import { leaguesOverview, matchesOverview, ruleSetsOverview, sealMismatches } from "./admin-content";
import { db, migrate, pool, query } from "./db";
import { operations } from "./operations";
import { createSession } from "./session";

/** The administration against a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("administration", () => {
  const stamp = Date.now();
  let admin: { id: string; email: string };
  let person: { id: string; email: string };

  beforeAll(async () => {
    await migrate();
    const make = async (email: string, role: string) => (await query<{ id: string }>("INSERT INTO accounts (email, role, password_hash) VALUES ($1, $2, 'x') RETURNING id", [email, role]))[0]!.id;
    admin = { id: await make(`adm-${stamp}@kachizaka.test`, "ADMIN"), email: `adm-${stamp}@kachizaka.test` };
    person = { id: await make(`per-${stamp}@kachizaka.test`, "USER"), email: `per-${stamp}@kachizaka.test` };
    await seedDemoLeague(db(), person.email);
  });
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE id = ANY($1)", [[admin.id, person.id]]);
    await pool().end();
  });

  it("lists the accounts with their leagues, and one account's detail", async () => {
    expect((await listUsers()).find((u) => u.id === person.id)).toMatchObject({ role: "USER", status: "ACTIVE", memberships: 1 });
    expect(await userDetail(person.id)).toMatchObject({ email: person.email, sessions: 0 });
  });

  it("reads the leagues, matches (with their seals and waiting facts) and rule sets", async () => {
    const league = (await leaguesOverview()).find((l) => l.owner === person.email);
    expect(league).toMatchObject({ members: 4, seasons: 1, matches: 3 });
    const matches = (await matchesOverview()).filter((m) => m.league === league!.name);
    expect(matches).toHaveLength(3);
    expect(matches.some((m) => m.status !== "scheduled" && m.seal?.startsWith("sha256:"))).toBe(true);
    expect(matches.every((m) => m.pendingFacts === 0)).toBe(true);
    expect((await ruleSetsOverview()).filter((r) => r.league === league!.name)[0]).toMatchObject({ version: 1 });
    expect(await sealMismatches()).toBe(0);
  });

  it("reads the operations figures", async () => {
    const ops = await operations();
    expect(ops.connections.open).toBeGreaterThan(0);
    expect(ops.connections.limit).toBeGreaterThan(0);
    expect(ops.pool.max).toBeGreaterThanOrEqual(1);
    expect(ops.mismatches).toBe(0);
  });

  it("suspends, restores, grants and withdraws the role, ends sessions — never on yourself", async () => {
    await createSession(person.id, { ip: "203.0.113.7", userAgent: "vitest" });
    expect((await setUserStatus(admin, person.id, "SUSPENDED")).sessions).toBe(0);
    expect((await setUserStatus(admin, person.id, "ACTIVE")).status).toBe("ACTIVE");
    await expect(setUserStatus(admin, admin.id, "SUSPENDED")).rejects.toMatchObject({ status: 409 });
    await expect(setUserRole(admin, admin.id, "USER")).rejects.toMatchObject({ status: 409 });
    expect((await setUserRole(admin, person.id, "ADMIN")).role).toBe("ADMIN");
    expect((await setUserRole(admin, person.id, "USER")).role).toBe("USER");
    await createSession(person.id, { ip: "203.0.113.8", userAgent: "vitest" });
    expect((await revokeUserSessions(admin, person.id)).revoked).toBe(1);
    expect((await auditLog(20, person.id)).map((e) => e.action)).toEqual(expect.arrayContaining(["admin.user_suspended", "admin.user_restored", "admin.user_role_changed", "admin.sessions_revoked"]));
  });

  it("exports the account with its predictions and points, never its password hash", async () => {
    const out = await exportAccount(admin, person.id);
    const text = JSON.stringify(out);
    expect(text).not.toContain("password");
    expect(out).toMatchObject({ format: "kachizaka-account-export/1", account: { email: person.email } });
    expect((out.predictions as unknown[]).length).toBeGreaterThan(0);
  });

  it("erases the account: the league keeps its history under « former member », the audit keeps the fact not the person", async () => {
    await expect(deleteAccount(admin, person.id, "someone@else.test")).rejects.toMatchObject({ status: 409, body: { code: "CONFIRM_MISMATCH" } });
    await expect(deleteAccount(admin, admin.id, admin.email)).rejects.toMatchObject({ status: 409, body: { code: "SELF_DELETE" } });
    await query("INSERT INTO audit_log (actor_id, actor_label, action, ip) VALUES ($1, $2, 'auth.sign_in', '203.0.113.7')", [person.id, person.email]);
    const before = await query<{ n: string }>("SELECT count(*) AS n FROM predictions p JOIN league_members m ON m.id = p.member_id WHERE m.account_id = $1", [person.id]);
    expect(await deleteAccount(admin, person.id, person.email.toUpperCase())).toEqual({ deleted: true, memberships: 1 });
    await expect(userDetail(person.id)).rejects.toMatchObject({ status: 404 });
    const names = await query<{ display_name: string }>("SELECT display_name FROM league_members WHERE display_name LIKE 'former member %'");
    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(Number((await query<{ n: string }>("SELECT count(*) AS n FROM predictions WHERE member_id IN (SELECT id FROM league_members WHERE display_name LIKE 'former member %')"))[0]!.n)).toBeGreaterThanOrEqual(Number(before[0]!.n));
    for (const row of await query<{ actor_label: string; ip: string | null }>("SELECT actor_label, ip FROM audit_log WHERE actor_id = $1", [person.id])) expect(row).toEqual({ actor_label: "deleted account", ip: null });
  });
});
