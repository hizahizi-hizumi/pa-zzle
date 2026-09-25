import { Outlet } from "react-router";

import { AppShell } from "@/components/AppShell";
import { readPlayRecords } from "@/records/storage";

export default function AppPage() {
  const clearedCount = readPlayRecords().filter(
    (record) => record.completedAt !== null,
  ).length;

  return (
    <AppShell contentLayout="contained">
      <p className="text-supporting">{`これまでのクリア ${clearedCount} 回`}</p>
      <Outlet />
    </AppShell>
  );
}
