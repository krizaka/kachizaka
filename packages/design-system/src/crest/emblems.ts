import { bolt, crown, flame, leaf, mountain, star, wave, type Glyph } from "@krizaka/icons/glyphs";

/**
 * The emblems a crest may carry, drawn on the 24 grid in the signature style (stroke, square caps, one node). Seven are
 * the generic icons of @krizaka/icons; the three beasts are ours, because a crest is the only place that needs them.
 */
const freeze = (g: Glyph): Glyph => Object.freeze(g);

const paw: Glyph = freeze({ c: [[6.5, 10.5, 1.8], [10.5, 6, 1.8], [15.5, 6, 1.8], [19.5, 10.5, 1.8]], p: ["M12 12.5c-3.5 0-6 3-6 5.5 0 1.8 1.5 2.5 3 2.5 1 0 2-.5 3-.5s2 .5 3 .5c1.5 0 3-.7 3-2.5 0-2.5-2.5-5.5-6-5.5z"], n: [[12, 16.5]] });
const antler: Glyph = freeze({ p: ["M12 21V10", "M12 14 7 9.5V4", "M7 9.5 3.5 7", "M12 14l5-4.5V4", "M17 9.5 20.5 7", "M12 10 9.5 6.5"], n: [[12, 21]] });
const wing: Glyph = freeze({ p: ["M3 18.5C4 10.5 9 5 21 4.5c-1 8.5-6 13.5-12.5 14", "M7.5 18.5 14 11", "M12 17.5 17 12"], n: [[21, 4.5]] });

export const EMBLEMS = Object.freeze({ paw, antler, wing, star, bolt, wave, flame, crown, leaf, mountain }) satisfies Record<string, Glyph>;

export type EmblemId = keyof typeof EMBLEMS;

/** Every emblem, in the order the generator draws from. */
export const EMBLEM_IDS = Object.freeze(Object.keys(EMBLEMS) as EmblemId[]);
