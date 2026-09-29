import { Outlet, type UIMatch, useLocation, useMatches } from "react-router";

// biome-ignore lint/style/noRestrictedImports: _app is the router root layout and composes the application shell.
import { AppShell } from "@/components/AppShell";

// generouted は 404.tsx を `path: "*"` のフォールバックルートとして登録するため、スプラットの一致で判定する。
function isNotFoundMatch(match: UIMatch | undefined): boolean {
  return match?.params["*"] !== undefined;
}

export default function AppPage() {
  const location = useLocation();
  const matches = useMatches();
  const contentLayout = isNotFoundMatch(matches.at(-1))
    ? "fill"
    : location.pathname === "/"
      ? "full"
      : "contained";

  return (
    <AppShell contentLayout={contentLayout}>
      <Outlet />
    </AppShell>
  );
}
