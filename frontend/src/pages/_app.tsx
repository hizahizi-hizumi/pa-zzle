import { Outlet } from "react-router";

import { AppShell } from "@/components/app-shell";

export default function AppPage() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
