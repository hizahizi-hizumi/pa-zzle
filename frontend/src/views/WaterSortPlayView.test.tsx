import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { waterSortCatalogEntry } from "@/app/game-integration/water-sort/water-sort-catalog-entry";
import { createProblemId } from "@/games/problem-id";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import { testPlayUrl } from "@/testing/play-url";
import { WaterSortPlayView } from "@/views/WaterSortPlayView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/water-sort/play/:problemId",
        element: <WaterSortPlayView />,
      },
      { path: "/puzzles/water-sort", element: <p>ゲームのホーム画面</p> },
    ],
    { initialEntries: [testPlayUrl(waterSortCatalogEntry, path)] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("WaterSortPlayView", () => {
  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectWaterSortProblemForDifficulty("1", "game-home-navigation").identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/water-sort/play/1?problem=${poolProblemId}`,
      );
    });

    test("その問題で始めURLを置き換えないこと", () => {
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe(
        `/puzzles/water-sort/play/${poolProblemId}`,
      );
      expect(location.search).toBe("");
      expect(historyAction).toBe("POP");
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/water-sort");
      expect(location.search).toBe(`?problem=${poolProblemId}`);
      expect(historyAction).toBe("REPLACE");
    });

    describe("メニューからゲームのホームを選んだ場合", () => {
      beforeEach(() => {
        openMenu();
      });

      test("遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "問題選択" }));
        const { historyAction, location } = router.state;

        expect(location.pathname).toBe("/puzzles/water-sort");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderRouterAt("/puzzles/water-sort/play/9");
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この問題は現在遊べません");
      const backLink = screen.getByRole("link", {
        name: "問題選択へ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/water-sort");
    });
  });
});
