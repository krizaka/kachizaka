import { PlayError } from "@kachizaka/db";
import { describe, expect, it } from "vitest";

import { HttpError } from "./http";
import { playing } from "./play-http";

describe("a refusal of the domain becomes an HTTP answer with a stable code", () => {
  it.each([
    ["PICK_LOCKED", 409],
    ["PICK_INVALID", 422],
    ["NOT_A_MEMBER", 403],
    ["INVITE_INVALID", 404],
  ] as const)("%s → %i", async (code, status) => {
    const error = await playing(async () => {
      throw new PlayError(code, "x");
    }).catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status, body: { code } });
  });
  it("lets anything else through untouched", async () => {
    await expect(playing(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});
