import { describe, expect, it } from "vitest";

import { hostAllowed } from "./access";
import { roleChangeRefusal } from "./admin";
import { budgetLimit, budgetShare } from "./operations-shared";

describe("who may change a role", () => {
  it("never your own", () => {
    expect(roleChangeRefusal("a", "a", "USER", 3, "ADMIN")).toMatchObject({ code: "SELF_ROLE" });
  });
  it("never withdraws the last administrator", () => {
    expect(roleChangeRefusal("a", "b", "USER", 1, "ADMIN")).toMatchObject({ code: "LAST_ADMIN" });
  });
  it("lets an administrator withdraw another while one remains, and grant the role", () => {
    expect(roleChangeRefusal("a", "b", "USER", 2, "ADMIN")).toBeNull();
    expect(roleChangeRefusal("a", "b", "ADMIN", 1, "USER")).toBeNull();
  });
  it("has nothing to refuse when the role does not change", () => {
    expect(roleChangeRefusal("a", "a", "ADMIN", 1, "ADMIN")).toBeNull();
  });
});

describe("the database budget", () => {
  it("is the role's own limit when it has one, else the server's", () => {
    expect(budgetLimit(22, 100)).toBe(22);
    expect(budgetLimit(-1, 100)).toBe(100);
    expect(budgetLimit(500, 100)).toBe(100);
  });
  it("shares what is used, capped, 0 without a budget", () => {
    expect(budgetShare(5, 20)).toBe(0.25);
    expect(budgetShare(30, 20)).toBe(1);
    expect(budgetShare(3, 0)).toBe(0);
  });
});

describe("the administration host", () => {
  const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" };
  const call = (host: string, ip: string) => new Headers({ host, "do-connecting-ip": ip });
  it("refuses a foreign address everywhere on admin.kachizaka.com, the sign-in included", () => {
    expect(hostAllowed(call("admin.kachizaka.com", "198.51.100.9"), env)).toBe(false);
    expect(hostAllowed(call("admin.kachizaka.com", "203.0.113.7"), env)).toBe(true);
  });
  it("leaves the product host open", () => {
    expect(hostAllowed(call("dev.kachizaka.com", "198.51.100.9"), env)).toBe(true);
  });
});
