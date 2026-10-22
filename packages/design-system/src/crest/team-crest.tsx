import { useId } from "react";
import type { Glyph } from "@krizaka/icons/glyphs";
import { check } from "@krizaka/icons/glyphs";

import { EMBLEMS } from "./emblems";
import { INK, inkOn, mix, PAPER } from "./palette";
import { type CrestInput, type CrestLayout, type CrestShape, crestSpec } from "./spec";

/** Sizes the crest is drawn for, in px: below 28 the stitch and the grain are left out (they would only be noise). */
// @fixed: the smallest size the crest's strokes stay legible at (design specimen, 16 px)
export const CREST_MIN = 16;
// @fixed: the largest size the crest is drawn for (the specimen's 128 px)
export const CREST_MAX = 128;

const OUTLINE: Record<CrestShape, string> = {
  shield: "M12 4H88L96 12V50C96 74 76 90 50 98 24 90 4 74 4 50V12Z",
  roundel: "M50 3a47 47 0 1 1 0 94a47 47 0 1 1 0-94Z",
  hexagon: "M50 3 91 26.5V73.5L50 97 9 73.5V26.5Z",
  banner: "M8 4H92V68L50 97 8 68Z",
};

/** Where the letters and the emblem sit, per layout: [monogram y, font sizes for 1/2/3 letters, emblem [x, y, size]]. */
const SETTING: Record<CrestLayout, { y: [number, number]; fs: [number, number, number]; emblem: [number, number, number]; over: "main" | "secondary" }> = {
  bar: { y: [53, 53], fs: [26, 23, 19], emblem: [50, 21, 24], over: "secondary" },
  chief: { y: [66, 66], fs: [38, 32, 26], emblem: [50, 17, 22], over: "main" },
  chevron: { y: [36, 40], fs: [36, 30, 25], emblem: [50, 82, 17], over: "main" },
  plain: { y: [52, 66], fs: [46, 38, 30], emblem: [50, 27, 24], over: "main" },
};
const LAYER: Record<CrestLayout, string | null> = {
  bar: "M0 38H100V68H0Z",
  chief: "M0 0H100V35H0Z",
  chevron: "M0 54 50 76 100 54V80L50 102 0 80Z",
  plain: null,
};

export interface TeamCrestProps extends Omit<CrestInput, "name"> {
  /** The team's name (or its id). */
  name: string;
  /** Pixels, 16 to 128 (clamped). Default 40. */
  size?: number;
  /**
   * The accessible label. Without it the crest is decorative (`aria-hidden`) — the right choice when the team's name is
   * written beside it, as it always is in a list or a match card.
   */
  label?: string;
  /** The crest settles in as it enters the view (a short rise, once). Still under reduced motion. */
  settle?: boolean;
  /** This team won: a seal is stamped on the crest (brief; still under reduced motion). */
  winner?: boolean;
  className?: string;
}

const clamp = (n: number) => Math.round(Math.min(CREST_MAX, Math.max(CREST_MIN, Number.isFinite(n) ? n : 40)));

function Glyphs({ glyph, x, y, size, color, node }: { glyph: Glyph; x: number; y: number; size: number; color: string; node: string }) {
  return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="square" strokeLinejoin="miter">
      {glyph.p?.map((d) => <path key={d} d={d} />)}
      {glyph.c?.map(([cx, cy, r]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} />)}
      {glyph.n?.map(([cx, cy]) => <circle key={`n${cx},${cy}`} cx={cx} cy={cy} r={1.7} fill={node} stroke="none" />)}
    </svg>
  );
}

/**
 * The crest of a team — generated from its name, free, ours: never a league's or a club's real badge. A shield, roundel,
 * hexagon or banner in enamel (a mid-tone that holds on the dark page and the light one), a band, cap or chevron in a
 * second colour, a stitched edge and a printed grain, the monogram in the display face and, for two teams in three, an
 * emblem. SVG, server-safe, no hook but `useId`. Names are written by the page, never by the crest.
 */
export function TeamCrest({ size = 40, label, settle = false, winner = false, className, ...input }: TeamCrestProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const px = clamp(size);
  const spec = crestSpec(input);
  const { layout, shape, main, secondary, monogram } = spec;
  const set = SETTING[layout];
  const emblem = spec.emblem ? EMBLEMS[spec.emblem] : null;
  const rim = mix(main, INK, 0.38);
  const under = set.over === "main" ? main : secondary;
  const letters = inkOn(under);
  const fs = set.fs[Math.min(3, monogram.length) - 1] ?? set.fs[2];
  const y = set.y[emblem ? 1 : 0] + fs * 0.35;
  const detailed = px >= 28;
  const layer = LAYER[layout];
  const emblemOver = layout === "chief" || layout === "chevron" ? secondary : layout === "bar" || layout === "plain" ? main : main;
  const emblemInk = inkOn(emblemOver);
  const [ex, ey, es] = set.emblem;
  const classes = ["kc-crest", settle ? "kc-crest-settle" : "", className ?? ""].filter(Boolean).join(" ");
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const, focusable: "false" as const };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={classes} width={px} height={px} viewBox="0 0 100 100" data-shape={shape} data-layout={layout} data-crest={spec.pair.id} {...a11y}>
      {label ? <title>{label}</title> : null}
      <defs>
        <clipPath id={`${uid}c`}>
          <path d={OUTLINE[shape]} />
        </clipPath>
        {detailed ? (
          <pattern id={`${uid}g`} width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="0.75" cy="0.75" r="0.45" fill={INK} opacity="0.17" />
            <circle cx="2.25" cy="2.25" r="0.35" fill={PAPER} opacity="0.12" />
          </pattern>
        ) : null}
      </defs>
      <path d={OUTLINE[shape]} fill={main} />
      <g clipPath={`url(#${uid}c)`}>
        {layer ? <path d={layer} fill={secondary} /> : null}
        {detailed ? <path d={OUTLINE[shape]} fill={`url(#${uid}g)`} /> : null}
        {detailed ? (
          <path d={OUTLINE[shape]} transform="translate(50 50) scale(.86) translate(-50 -50)" fill="none" stroke={layout === "plain" ? secondary : inkOn(main)} strokeOpacity={layout === "plain" ? 0.95 : 0.55} strokeWidth={1.1} strokeDasharray="2.6 2.4" />
        ) : null}
      </g>
      <path d={OUTLINE[shape]} fill="none" stroke={rim} strokeWidth={px >= 28 ? 3 : 4.5} strokeLinejoin="miter" />
      {emblem ? <Glyphs glyph={emblem} x={ex} y={ey} size={es} color={emblemInk} node={emblemInk} /> : null}
      <text x="50" y={y} textAnchor="middle" fontSize={fs} fill={letters} className="kc-crest-letters" style={{ fontFamily: "var(--kz-font-display, 'Young Serif', Georgia, serif)", letterSpacing: monogram.length > 1 ? "0.02em" : 0 }}>
        {monogram}
      </text>
      {winner ? (
        <g className="kc-crest-stamp" data-stamp="">
          <circle cx="82" cy="82" r="14.5" fill={PAPER} stroke={INK} strokeWidth="2" />
          <circle cx="82" cy="82" r="11.5" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 2" />
          <Glyphs glyph={check} x={82} y={82} size={14} color={INK} node={INK} />
        </g>
      ) : null}
    </svg>
  );
}
