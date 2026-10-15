import { RuleSetsTable } from "@/components/admin/AdminTables";
import { ruleSetsOverview } from "@/lib/admin-content";

export default async function AdminRules() {
  return <RuleSetsTable ruleSets={await ruleSetsOverview()} />;
}
