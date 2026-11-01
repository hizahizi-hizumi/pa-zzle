import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";

import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { NanpurePlayView } from "@/views/NanpurePlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => "nanpure-play-view",
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/nanpure/play/:difficulty"
          element={<NanpurePlayView />}
        />
        <Route path="/puzzles/nanpure" element={<p>ゲームのホーム画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/nanpure/play/:difficulty",
        element: <NanpurePlayView />,
      },
      { path: "/puzzles/nanpure", element: <p>ゲームのホーム画面</p> },
    ],
    { initialEntries: [path] },
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

describe("NanpurePlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/nanpure/play/5");
    });

    test("9×9 の盤面を持つプレイ画面を表示すること", () => {
      const cells = screen.getAllByRole("button", { name: /^\d行\d列、/ });

      expect(cells).toHaveLength(81);
    });
  });

  describe("内部診断を使える環境の場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/nanpure/play/4");
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(dialog.textContent).toContain("レベル 4");
      expect(dialog.textContent).toMatch(/np-/);
    });
  });

  const invalidCases = ["9", "normal"] as const;

  describe.each(invalidCases)("未定義の難易度 %s の場合", (difficulty) => {
    beforeEach(() => {
      renderAt(`/puzzles/nanpure/play/${difficulty}`);
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", {
        name: "ゲームのホームへ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/nanpure");
    });
  });

  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectNanpureProblemForDifficulty("1", "game-home-navigation").identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/nanpure/play/1?problem=${poolProblemId}`,
      );
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "ゲームのホームへ戻る" }),
      );
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/nanpure");
      expect(location.search).toBe(`?problem=${poolProblemId}`);
      expect(historyAction).toBe("REPLACE");
    });

    describe("メニューからゲームのホームを選んだ場合", () => {
      beforeEach(() => {
        openMenu();
      });

      test("遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
        fireEvent.click(
          screen.getByRole("menuitem", { name: "ゲームのホーム" }),
        );
        const { historyAction, location } = router.state;

        expect(location.pathname).toBe("/puzzles/nanpure");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });
});
