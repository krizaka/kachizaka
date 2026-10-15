import { MatchesTable } from "@/components/admin/AdminTables";
import { matchesOverview } from "@/lib/admin-content";

export default async function AdminMatches() {
  return <MatchesTable matches={await matchesOverview()} />;
}
