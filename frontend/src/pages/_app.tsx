import { Outlet, type UIMatch, useLocation, useMatches } from "react-router";

// biome-ignore lint/style/noRestrictedImports: _app is the router root layout and composes the application shell.
import { AppShell } from "@/components/AppShell";
import { NotFoundView } from "@/views/NotFoundView";

// generouted は 404.tsx を `path: "*"` のフォールバックルートとして登録するため、スプラットの一致で判定する。
function isNotFoundMatch(match: UIMatch | undefined): boolean {
  return match?.params["*"] !== undefined;
}

// generouted はページを持たないディレクトリ（`puzzles/[game]` など）にも ID の無いルートを作り、React Router が数字の ID を振る。
// そこで終わる URL（今のアプリに無いゲームのホームなど）は、それ自体の画面が無いので見つからない画面にする。
// 判定は React Router が ID の無いルートへ振る ID の形（位置の番号を `-` でつないだもの）に依るので、その形を変える React Router の更新で壊れる。
function isPagelessMatch(match: UIMatch | undefined): boolean {
  return match !== undefined && /^\d+(-\d+)*$/.test(match.id);
}

// ゲームのホーム（`puzzles/<game>/index`）は図鑑の台紙だけをスクロールさせるので、画面の高さに収める。
function isViewportRoute(match: UIMatch | undefined): boolean {
  return match?.id !== undefined && /^puzzles\/[^/]+\/index$/.test(match.id);
}

export default function AppPage() {
  const location = useLocation();
  const matches = useMatches();
  const isPageless = isPagelessMatch(matches.at(-1));
  const contentLayout =
    isNotFoundMatch(matches.at(-1)) || isPageless
      ? "fill"
      : isViewportRoute(matches.at(-1))
        ? "viewport"
        : location.pathname === "/"
          ? "full"
          : "contained";

  return (
    <AppShell contentLayout={contentLayout}>
      {isPageless ? <NotFoundView /> : <Outlet />}
    </AppShell>
  );
}
