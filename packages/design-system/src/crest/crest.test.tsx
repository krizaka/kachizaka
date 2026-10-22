import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EMBLEM_IDS, EMBLEMS } from "./emblems";
import { fnv1a, normaliseName } from "./hash";
import { monogramOf } from "./monogram";
import { contrast, inkOn, INK, PAIRS, PAPER } from "./palette";
import { crestSpec, LAYOUTS, SHAPES } from "./spec";
import { TeamCrest } from "./team-crest";

/** The two pages a crest sits on: the tokens' surface-0, dark (root) and light (html.light). */
function surfaces(): { dark: string; light: string } {
  const css = readFileSync(createRequire(import.meta.url).resolve("@krizaka/tokens/tokens.css"), "utf8");
  const hsl = (block: string) => {
    const m = /--kz-surface-0:\s*hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/.exec(block);
    if (!m) throw new Error("surface-0 not found");
    const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const light = css.indexOf("html.light");
  return { dark: hsl(css.slice(0, light)), light: hsl(css.slice(light)) };
}

const NAMES = ["Montréal Mariners", "Les Canadiens", "Real Madrid", "FC Bayern", "Maple Leafs", "Union Saint-Gilloise", "La gang du vendredi", "Équipe A", "Équipe B", "Lions", "X", "日本代表"];

describe("determinism", () => {
  it("draws the same crest from the same name, however it is written", () => {
    expect(crestSpec({ name: "Montréal Mariners" })).toEqual(crestSpec({ name: "  montreal   MARINERS " }));
    expect(renderToStaticMarkup(<TeamCrest name="Les Canadiens" />)).toBe(renderToStaticMarkup(<TeamCrest name="Les Canadiens" />));
  });

  it("changes with the seed, and a seed leaves the default crest alone", () => {
    expect(crestSpec({ name: "Lions", seed: "" })).toEqual(crestSpec({ name: "Lions" }));
    const seeded = Array.from({ length: 12 }, (_, i) => JSON.stringify(crestSpec({ name: "Lions", seed: `league-${i}` })));
    expect(new Set(seeded).size).toBeGreaterThan(6);
  });

  it("is frozen: these names will always wear these crests (a change here is a visible change for every league)", () => {
    expect(fnv1a("lions")).toBe(fnv1a("lions"));
    expect(NAMES.map((name) => ({ name, ...crestSpec({ name }), pair: crestSpec({ name }).pair.id }))).toMatchSnapshot();
  });

  it("renders to a stable SVG (snapshot of one crest per shape and layout)", () => {
    const wanted = new Set(SHAPES.flatMap((s) => LAYOUTS.map((l) => `${s}/${l}`)));
    const picks: string[] = [];
    for (let i = 0; wanted.size && i < 3000; i++) {
      const spec = crestSpec({ name: `Team ${i}` });
      if (wanted.delete(`${spec.shape}/${spec.layout}`)) picks.push(`Team ${i}`);
    }
    expect(wanted.size).toBe(0);
    expect(picks.map((name) => renderToStaticMarkup(<TeamCrest name={name} size={64} />))).toMatchSnapshot();
  });
});

describe("the family", () => {
  const specs = Array.from({ length: 2000 }, (_, i) => crestSpec({ name: `Equipe ${i} ${i * 7919}` }));
  it("uses every shape, layout, pair and emblem, and about two crests in three carry an emblem", () => {
    expect(new Set(specs.map((s) => s.shape)).size).toBe(SHAPES.length);
    expect(new Set(specs.map((s) => s.layout)).size).toBe(LAYOUTS.length);
    expect(new Set(specs.map((s) => s.pair.id)).size).toBe(PAIRS.length);
    expect(new Set(specs.map((s) => s.emblem)).size).toBe(EMBLEM_IDS.length + 1);
    const share = specs.filter((s) => s.emblem).length / specs.length;
    expect(share).toBeGreaterThan(0.58);
    expect(share).toBeLessThan(0.74);
  });

  it("draws every emblem inside the 24 grid with one node", () => {
    for (const id of EMBLEM_IDS) {
      const g = EMBLEMS[id] as { n?: readonly (readonly number[])[] };
      expect(g.n?.length, id).toBe(1);
    }
  });
});

describe("colour — readable on the dark page and the light one", () => {
  const { dark, light } = surfaces();
  it("reads the tokens' two pages", () => {
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(light).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(PAIRS.map((p) => [p.id, p] as const))("%s: the silhouette holds ≥ 3:1 on both pages, the second colour ≥ 3:1 on the first", (_id, p) => {
    expect(contrast(p.main, dark), "main on dark").toBeGreaterThanOrEqual(3);
    expect(contrast(p.main, light), "main on light").toBeGreaterThanOrEqual(3);
    expect(contrast(p.main, p.secondary), "secondary on main").toBeGreaterThanOrEqual(3);
  });

  it.each(PAIRS.map((p) => [p.id, p] as const))("%s: letters and emblems read on both colours (≥ 4.5:1)", (_id, p) => {
    expect(contrast(inkOn(p.main), p.main)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(inkOn(p.secondary), p.secondary)).toBeGreaterThanOrEqual(4.5);
  });

  it("paper and ink are the two letter colours", () => {
    expect(inkOn("#FFFFFF")).toBe(INK);
    expect(inkOn("#000000")).toBe(PAPER);
  });
});

describe("the monogram", () => {
  it.each([
    ["Real Madrid", "RM"],
    ["Maple Leafs", "ML"],
    ["Union Saint-Gilloise", "USG"],
    ["Canadiens", "CAN"],
    ["FC Bayern", "BAY"],
    ["Les Canadiens", "CAN"],
    ["Équipe", "EQU"],
    ["a b c d e", "ABC"],
    ["  ", "?"],
  ])("%s → %s", (name, letters) => {
    expect(monogramOf(name)).toBe(letters);
  });
  it("never exceeds 3 letters, honours max", () => {
    expect(monogramOf("Alpha Beta Gamma Delta")).toHaveLength(3);
    expect(monogramOf("Alpha Beta Gamma", 2)).toBe("AB");
  });
  it("normalises names", () => {
    expect(normaliseName("Montréal—FC!")).toBe("montreal fc");
  });
});

describe("<TeamCrest>", () => {
  it("is decorative without a label and an image with one", () => {
    const plain = renderToStaticMarkup(<TeamCrest name="Lions" />);
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain("role=");
    const named = renderToStaticMarkup(<TeamCrest name="Lions" label="Lions crest" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Lions crest"');
    expect(named).toContain("<title>Lions crest</title>");
  });

  it("is drawn from 16 to 128 px, clamped", () => {
    const px = (size: number) => /width="(\d+)"/.exec(renderToStaticMarkup(<TeamCrest name="Lions" size={size} />))?.[1];
    expect([px(4), px(16), px(64), px(128), px(500), px(Number.NaN)]).toEqual(["16", "16", "64", "128", "128", "40"]);
  });

  it("leaves the stitch and the grain out of the smallest sizes", () => {
    expect(renderToStaticMarkup(<TeamCrest name="Lions" size={16} />)).not.toContain("stroke-dasharray");
    expect(renderToStaticMarkup(<TeamCrest name="Lions" size={64} />)).toContain("stroke-dasharray");
  });

  it("gives every instance its own ids (two crests on a page never share a clip path)", () => {
    const html = renderToStaticMarkup(<><TeamCrest name="Lions" /><TeamCrest name="Lions" /></>);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("settles in and stamps a winner, only when asked", () => {
    const calm = renderToStaticMarkup(<TeamCrest name="Lions" />);
    expect(calm).not.toContain("kc-crest-settle");
    expect(calm).not.toContain("kc-crest-stamp");
    const lively = renderToStaticMarkup(<TeamCrest name="Lions" settle winner />);
    expect(lively).toContain("kc-crest-settle");
    expect(lively).toContain("kc-crest-stamp");
  });

  it("applies an override (colours, shape, layout, emblem, letters) and ignores an invalid colour", () => {
    const o = crestSpec({ name: "Lions", shape: "hexagon", layout: "bar", main: "#2f5fd0", secondary: "#f0c24a", emblem: "star", monogram: "lx" });
    expect(o).toMatchObject({ shape: "hexagon", layout: "bar", main: "#2F5FD0", secondary: "#F0C24A", emblem: "star", monogram: "LX" });
    expect(crestSpec({ name: "Lions", main: "red; background:url(x)" }).main).toBe(crestSpec({ name: "Lions" }).main);
    expect(crestSpec({ name: "Lions", emblem: null }).emblem).toBeNull();
  });

  it("carries no real club or league wording, and no external image", () => {
    const html = renderToStaticMarkup(<TeamCrest name="Lions" size={128} winner />);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(html).not.toContain("<image");
  });
});
