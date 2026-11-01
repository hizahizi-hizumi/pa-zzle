import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";

import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { ParkingJamPlayView } from "@/views/ParkingJamPlayView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/parking-jam/play/:difficulty"
          element={<ParkingJamPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function countRenderedCars(): number {
  return document.querySelectorAll(".parking-jam-car__body").length;
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/parking-jam/play/:difficulty",
        element: <ParkingJamPlayView />,
      },
      { path: "/puzzles/parking-jam", element: <p>ゲームのホーム画面</p> },
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

describe("ParkingJamPlayView", () => {
  describe("定義済みのレベルの場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/parking-jam/play/5");
    });

    test("プレイ画面を表示すること", () => {
      const message = screen.queryByText("この難易度は選べません");

      expect(message).toBeNull();
      expect(countRenderedCars()).toBeGreaterThan(0);
    });
  });

  const invalidDifficultyCases = ["hard", "6"] as const;

  describe.each(invalidDifficultyCases)("レベルでない %s の場合", (value) => {
    beforeEach(() => {
      renderAt(`/puzzles/parking-jam/play/${value}`);
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", {
        name: "ゲームのホームへ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/parking-jam");
    });
  });

  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectParkingJamProblemForDifficulty("1", "game-home-navigation")
        .identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/parking-jam/play/1?problem=${poolProblemId}`,
      );
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "ゲームのホームへ戻る" }),
      );
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/parking-jam");
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

        expect(location.pathname).toBe("/puzzles/parking-jam");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });
});
