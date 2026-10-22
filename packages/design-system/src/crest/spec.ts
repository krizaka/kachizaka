import { fnv1a, normaliseName, sequence } from "./hash";
import { EMBLEM_IDS, type EmblemId } from "./emblems";
import { monogramOf } from "./monogram";
import { type InkPair, isHexColor, PAIRS } from "./palette";

export const SHAPES = ["shield", "roundel", "hexagon", "banner"] as const;
export const LAYOUTS = ["bar", "chief", "chevron", "plain"] as const;
export type CrestShape = (typeof SHAPES)[number];
export type CrestLayout = (typeof LAYOUTS)[number];

/** What a league admin or a member may later override, as stored data: any key left out is generated. */
export interface CrestOverride {
  shape?: CrestShape;
  layout?: CrestLayout;
  /** `#rrggbb`. */
  main?: string;
  /** `#rrggbb`. */
  secondary?: string;
  /** An emblem id, or `null` for none. */
  emblem?: EmblemId | null;
  /** 1–3 letters. */
  monogram?: string;
}

export interface CrestInput extends CrestOverride {
  /** The team's name (or its id): what the crest is drawn from. */
  name: string;
  /** Another crest for the same name (two teams called alike in two leagues): any string. */
  seed?: string;
}

export interface CrestSpec {
  shape: CrestShape;
  layout: CrestLayout;
  pair: InkPair;
  main: string;
  secondary: string;
  emblem: EmblemId | null;
  monogram: string;
}

const pick = <T,>(items: readonly T[], r: number): T => items[Math.min(items.length - 1, Math.floor(r * items.length))] as T;

/**
 * The crest of a team: pure and deterministic — the same name (and seed) always gives the same spec, on every
 * platform. About two teams in three wear an emblem. An override replaces only what it names; a colour that is not
 * `#rrggbb` is ignored.
 */
export function crestSpec({ name, seed = "", ...override }: CrestInput): CrestSpec {
  const next = sequence(fnv1a(`${normaliseName(name)}|${seed}`));
  const shape = pick(SHAPES, next());
  const layout = pick(LAYOUTS, next());
  const pair = pick(PAIRS, next());
  const hasEmblem = next() < 0.66;
  const emblemId = pick(EMBLEM_IDS, next());
  const main = override.main && isHexColor(override.main) ? override.main.toUpperCase() : pair.main;
  const secondary = override.secondary && isHexColor(override.secondary) ? override.secondary.toUpperCase() : pair.secondary;
  const custom = override.monogram ? monogramOf(override.monogram) : null;
  return {
    shape: override.shape ?? shape,
    layout: override.layout ?? layout,
    pair,
    main,
    secondary,
    emblem: override.emblem === undefined ? (hasEmblem ? emblemId : null) : override.emblem,
    monogram: custom ?? monogramOf(name),
  };
}
