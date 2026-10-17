import { BasketballIcon, HockeyIcon, SoccerIcon } from "@krizaka/icons";

import type { SportId } from "@/lib/sports";

const ICONS = { soccer: SoccerIcon, hockey: HockeyIcon, basketball: BasketballIcon } as const;

/** A sport's signature icon from @krizaka/icons — decorative (its name is always written beside it). */
export function SportIcon({ sport, size = 18 }: { sport: SportId; size?: number }) {
  const Icon = ICONS[sport];
  return <Icon size={size} aria-hidden />;
}
