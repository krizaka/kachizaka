import { LeaguesTable } from "@/components/admin/AdminTables";
import { leaguesOverview } from "@/lib/admin-content";

export default async function AdminLeagues() {
  return <LeaguesTable leagues={await leaguesOverview()} />;
}
