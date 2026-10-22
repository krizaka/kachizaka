/**
 * The crest's inks. A crest is an enamel badge on a page that is dark or light, so its MAIN colour (the field and the
 * rim — the silhouette) is a mid-tone that holds ≥ 3:1 against both pages (`src/crest/crest.test.ts` proves it from
 * the tokens' surfaces); its SECONDARY colour (a band, a cap, a chevron, the stitch) holds ≥ 3:1 against the main;
 * letters are paper or ink, whichever reads best on what is under them (≥ 4.5:1). Fixed mid-tones on purpose, like the
 * brand marks: a team's identity must not change with the theme.
 */
export const PAPER = "#F5EFDF";
export const INK = "#14120F";

export interface InkPair {
  readonly id: string;
  readonly main: string;
  readonly secondary: string;
}

export const PAIRS: readonly InkPair[] = Object.freeze([
  { id: "cobalt-gold", main: "#2F5FD0", secondary: "#F0C24A" },
  { id: "crimson-paper", main: "#C23B3B", secondary: PAPER },
  { id: "forest-paper", main: "#2E9460", secondary: PAPER },
  { id: "ochre-navy", main: "#B27520", secondary: "#142447" },
  { id: "violet-gold", main: "#7A52C7", secondary: "#F0C24A" },
  { id: "teal-pine", main: "#208F8F", secondary: "#0F3526" },
  { id: "rust-mint", main: "#AE4E2A", secondary: "#B5E2C9" },
  { id: "plum-blush", main: "#AB4486", secondary: "#F4C3BB" },
  { id: "slate-sky", main: "#5B6B86", secondary: "#A9CDF2" },
  { id: "olive-pine", main: "#6F8A2A", secondary: "#0F3526" },
  { id: "steel-navy", main: "#4284C2", secondary: "#142447" },
  { id: "magenta-paper", main: "#B83280", secondary: PAPER },
  { id: "crimson-gold", main: "#C23B3B", secondary: "#F0C24A" },
  { id: "cobalt-paper", main: "#2F5FD0", secondary: PAPER },
  { id: "forest-navy", main: "#2E9460", secondary: "#142447" },
  { id: "violet-mint", main: "#7A52C7", secondary: "#B5E2C9" },
]);

const channel = (hex: string, i: number) => {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of `#rrggbb`. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** WCAG contrast ratio between two `#rrggbb` colours (1–21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Paper or ink, whichever reads best on `background`. */
export function inkOn(background: string): string {
  return contrast(PAPER, background) >= contrast(INK, background) ? PAPER : INK;
}

/** A colour moved toward another by `amount` (0–1), per channel in sRGB: the rim is the main colour pulled toward ink. */
export function mix(a: string, b: string, amount: number): string {
  const to = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const part = (i: number) => Math.round(to(a, i) + (to(b, i) - to(a, i)) * amount).toString(16).padStart(2, "0");
  return `#${part(0)}${part(1)}${part(2)}`.toUpperCase();
}

/** `#rrggbb` only: a custom colour is refused otherwise, so a crest never carries an arbitrary string into the page. */
export const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);
