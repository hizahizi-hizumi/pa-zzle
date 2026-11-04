/**
 * 一方向ドア面: URL（golden の仕組みは `golden-file.ts`）。
 * ブックマーク・共有したリンク・記録の結果画面のリンクは URL で画面と問題を指すので、ルートのパスと問題 ID のクエリを固定する。
 * golden の更新: `bun run --cwd frontend test golden -u`（その PR は PO の承認が要る扱いになる）。
 */

import {
  generatePreservedRoutes,
  generateRegularRoutes,
} from "@generouted/react-router/core";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import { expectGoldenFile } from "./golden-file";

type GeneratedRoute = { path?: string; children?: GeneratedRoute[] };

/**
 * `@generouted/react-router` がルートを作るのと同じページの集め方。モジュールは読み込まず、ファイルの位置だけを使う。
 * generouted の版を上げて集め方が変わったら、ここも合わせる。
 */
const regularPages = import.meta.glob([
  "/src/pages/**/[A-Za-z0-9[-]*.{jsx,tsx,mdx}",
  "/src/pages/**/_layout.{jsx,tsx,mdx}",
  "!/src/pages/404.{jsx,tsx,mdx}",
  "!/src/pages/**/_*/**",
]);
const preservedPages = import.meta.glob("/src/pages/{_app,404}.{jsx,tsx}");
const modalPages = import.meta.glob("/src/pages/**/[+]*.{jsx,tsx}");

function listRoutePaths(
  routes: readonly GeneratedRoute[],
  parentPath = "",
): string[] {
  return routes.flatMap(({ path, children }) => {
    // index のルートは path が無いか "/" なので、親のパスのままにする。
    const segment = path?.replace(/^\/+|\/+$/g, "") ?? "";
    const routePath = segment === "" ? parentPath : `${parentPath}/${segment}`;
    return children
      ? listRoutePaths(children, routePath)
      : [routePath === "" ? "/" : routePath];
  });
}

describe("SPEC-014・SCR-001〜SCR-007 URL", () => {
  const exampleProblemId = "0123456789";

  test("ページのルートのパスと、問題 ID で問題を指すクエリが golden と一致すること", async () => {
    const urls = {
      routePaths: [
        ...new Set(
          listRoutePaths(
            generateRegularRoutes<GeneratedRoute, unknown>(
              regularPages,
              () => ({}),
            ),
          ),
        ),
      ].sort(),
      notFoundRoute:
        "404" in generatePreservedRoutes(preservedPages) ? "*" : null,
      modalPages: Object.keys(modalPages).sort(),
      problemIdSearch: createProblemIdSearch(exampleProblemId),
    };

    await expectGoldenFile(urls, "snapshots/routes.json");
  });
});
