import { Outlet, useLocation } from "react-router";

import { AppShell } from "@/components/AppShell";

export default function AppPage() {
  const location = useLocation();
  const contentLayout = location.pathname === "/" ? "full" : "contained";

  return (
    <AppShell contentLayout={contentLayout}>
      <Outlet />
    </AppShell>
  );
}
