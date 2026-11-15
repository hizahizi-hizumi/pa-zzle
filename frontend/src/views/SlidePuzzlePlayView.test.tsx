import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { slidePuzzleCatalogEntry } from "@/app/game-integration/slide-puzzle/slide-puzzle-catalog-entry";
import { createProblemId } from "@/games/problem-id";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import { testPlayUrl } from "@/testing/play-url";
import { SlidePuzzlePlayView } from "@/views/SlidePuzzlePlayView";

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
        path: "/puzzles/slide-puzzle/play/:problemId",
        element: <SlidePuzzlePlayView />,
      },
      { path: "/puzzles/slide-puzzle", element: <p>ゲームのホーム画面</p> },
    ],
    { initialEntries: [testPlayUrl(slidePuzzleCatalogEntry, path)] },
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

describe("SlidePuzzlePlayView", () => {
  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectSlidePuzzleProblemForDifficulty("1", "game-home-navigation")
        .identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/slide-puzzle/play/1?problem=${poolProblemId}`,
      );
    });

    test("その問題で始めURLを置き換えないこと", () => {
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe(
        `/puzzles/slide-puzzle/play/${poolProblemId}`,
      );
      expect(location.search).toBe("");
      expect(historyAction).toBe("POP");
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/slide-puzzle");
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

        expect(location.pathname).toBe("/puzzles/slide-puzzle");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderRouterAt("/puzzles/slide-puzzle/play/9");
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この問題は現在遊べません");
      const backLink = screen.getByRole("link", {
        name: "問題選択へ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/slide-puzzle");
    });
  });
});
