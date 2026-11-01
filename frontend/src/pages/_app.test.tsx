import { routes } from "@generouted/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";

// 生成されたルート表をそのまま使い、ルートの一致からレイアウトと見つからない画面を選ぶ流れを通す。
// ルート表のページを置くディレクトリにテストを置くとページとして読み込まれるため、図鑑の URL の移し先もここで確かめる。

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

type AppRouter = ReturnType<typeof createMemoryRouter>;

// jsdom はレイアウトを計算しないため、見つからない画面の盤面を描ける寸法を返させる。
const area = { width: 390, height: 796 };
const notFoundHeading = "ページが見つかりません";
const viewportClassName = "h-[calc(100dvh-3rem-env(safe-area-inset-top))]";
const containedClassName = "max-w-5xl";

let router: AppRouter;

function renderAppAt(path: string): void {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    area.width,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    area.height,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe("AppPage", () => {
  describe("ページを持たないディレクトリのルートで終わるURLの場合", () => {
    beforeEach(() => {
      renderAppAt("/puzzles/unknown-game");
    });

    test("見つからない画面を出すこと", () => {
      const heading = screen.getByRole("heading", { name: notFoundHeading });

      expect(heading).toBeTruthy();
    });
  });

  describe("どのルートにも一致しないURLの場合", () => {
    beforeEach(() => {
      renderAppAt("/missing/page");
    });

    test("見つからない画面を出すこと", () => {
      const heading = screen.getByRole("heading", { name: notFoundHeading });

      expect(heading).toBeTruthy();
    });
  });

  describe("ゲームのホームのURLの場合", () => {
    beforeEach(() => {
      renderAppAt(waterSortCatalogEntry.homePath);
    });

    test("ゲームのホームを画面の高さに収める領域へ出すこと", () => {
      const main = screen.getByRole("main");
      const heading = screen.getByRole("heading", { level: 1 });

      expect(heading.textContent).toBe(waterSortCatalogEntry.name);
      expect(main.className).toContain(viewportClassName);
    });
  });

  describe("記録画面のURLの場合", () => {
    beforeEach(() => {
      renderAppAt("/records");
    });

    test("読みやすい幅に収める領域へ出すこと", () => {
      const main = screen.getByRole("main");

      expect(main.className).toContain(containedClassName);
      expect(main.className).not.toContain(viewportClassName);
    });
  });
});

describe("GameZukanRedirect", () => {
  describe("今のアプリにあるゲームの図鑑のURLの場合", () => {
    beforeEach(() => {
      renderAppAt(`${waterSortCatalogEntry.homePath}/zukan`);
    });

    test("履歴を置き換えてそのゲームのホームへ移ること", () => {
      const { historyAction, location } = router.state;
      const heading = screen.getByRole("heading", { level: 1 });

      expect(location.pathname).toBe(waterSortCatalogEntry.homePath);
      expect(historyAction).toBe("REPLACE");
      expect(heading.textContent).toBe(waterSortCatalogEntry.name);
    });
  });

  describe("今のアプリに無いゲームの図鑑のURLの場合", () => {
    beforeEach(() => {
      renderAppAt("/puzzles/unknown-game/zukan");
    });

    test("移った先で見つからない画面を出すこと", () => {
      const { location } = router.state;
      const heading = screen.getByRole("heading", { name: notFoundHeading });

      expect(location.pathname).toBe("/puzzles/unknown-game");
      expect(heading).toBeTruthy();
    });
  });
});
