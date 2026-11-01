import { Outlet, type UIMatch, useLocation, useMatches } from "react-router";

// biome-ignore lint/style/noRestrictedImports: _app is the router root layout and composes the application shell.
import { AppShell } from "@/components/AppShell";

// generouted は 404.tsx を `path: "*"` のフォールバックルートとして登録するため、スプラットの一致で判定する。
function isNotFoundMatch(match: UIMatch | undefined): boolean {
  return match?.params["*"] !== undefined;
}

// 図鑑は台紙だけをスクロールさせるので、画面の高さに収める。
function isViewportRoute(match: UIMatch | undefined): boolean {
  return match?.id === "puzzles/[game]/zukan/index";
}

export default function AppPage() {
  const location = useLocation();
  const matches = useMatches();
  const contentLayout = isNotFoundMatch(matches.at(-1))
    ? "fill"
    : isViewportRoute(matches.at(-1))
      ? "viewport"
      : location.pathname === "/"
        ? "full"
        : "contained";

  return (
    <AppShell contentLayout={contentLayout}>
      <Outlet />
    </AppShell>
  );
}
