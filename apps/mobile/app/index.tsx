import { DEFAULT_RULES, scorePrediction } from "@kachizaka/core";
import { Mascot, ProductMark, Screen, Txt } from "@krizaka/ui/native";

/** The first screen: the mark, the magpie and the promise — the same scorer as the web, from @kachizaka/core. */
export default function Home() {
  const example = scorePrediction(DEFAULT_RULES, { home: 3, away: 2 }, { home: 2, away: 1 });
  return (
    <Screen>
      <ProductMark id="kachizaka" size={96} title="Kachizaka" />
      <Mascot bird="magpie" mood="welcome" size={88} />
      <Txt variant="title">Kachizaka</Txt>
      <Txt tone="secondary">Predictions among friends — points only. Sign-up is closed while Kachizaka is in development.</Txt>
      <Txt tone="muted">3–2 for a 2–1: {example.points} points ({example.breakdown.map((l) => l.rule).join(" + ")}).</Txt>
    </Screen>
  );
}
