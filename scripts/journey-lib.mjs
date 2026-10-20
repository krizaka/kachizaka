/** One clip per beat, cut from the full take: each runs to the next beat's start, the last to the end of the take. */
export function cutPlan(beats, duration) {
  return beats.map((b, i) => ({ name: b.name, from: b.at, to: beats[i + 1]?.at ?? duration }));
}

/** The real capture rate: frames the compositor painted per second while the page was moving (gaps under 100 ms). */
export function activeFps(frames) {
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
  const moving = gaps.filter((g) => g < 0.1);
  const span = moving.reduce((s, g) => s + g, 0);
  return span > 0 ? moving.length / span : 0;
}
