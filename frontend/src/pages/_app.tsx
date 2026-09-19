import { Outlet, useLocation } from "react-router";

// biome-ignore lint/style/noRestrictedImports: _app is the router root layout and composes the application shell.
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
