import { TeamCrest } from "@kachizaka/design-system";
import { cn } from "@krizaka/ui/cn";

/**
 * A team as the product writes it: its generated crest (Kachizaka's design system — never a real club's badge) and its
 * name. The crest is decorative here, the name is the accessible text. `seed` keeps two teams that share a name in two
 * leagues apart.
 */
export function TeamName({ name, size = 28, winner = false, settle = false, seed, className = "" }: { name: string; size?: number; winner?: boolean; settle?: boolean; seed?: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <TeamCrest name={name} size={size} winner={winner} settle={settle} seed={seed} />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}
