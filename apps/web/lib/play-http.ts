import { PlayError } from "@kachizaka/db";

import { HttpError, refuse } from "./http";

const STATUS = { INVITE_INVALID: 404, NOT_A_MEMBER: 403, MATCH_UNKNOWN: 404, PICK_INVALID: 422, PICK_LOCKED: 409, COMPETITION_UNKNOWN: 422 } as const satisfies Record<PlayError["code"], number>;

/** Runs a play action: a refusal of the domain becomes its HTTP answer with a stable code the page translates. */
export async function playing<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PlayError) throw refuse(STATUS[error.code], error.code, error.message);
    if (error instanceof HttpError) throw error;
    throw error;
  }
}
