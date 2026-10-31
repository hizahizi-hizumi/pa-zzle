import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { IceFloorMazePlayView } from "@/views/IceFloorMazePlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  vi.restoreAllMocks();
});

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/ice-floor-maze/play/:difficulty",
        element: <IceFloorMazePlayView />,
      },
      { path: "/puzzles/ice-floor-maze", element: <p>難易度選択画面</p> },
      { path: "/", element: <p>ホーム画面</p> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function readProblemId(router: PlayRouter): string | null {
  return new URLSearchParams(router.state.location.search).get("problem");
}

/** 盤面の外壁の枠を除いた列数・行数。 */
function readBoardShape(): string {
  const board = screen.getByRole("img", { name: "盤面" });
  const [, , viewWidth, viewHeight] = (board.getAttribute("viewBox") ?? "")
    .split(" ")
    .map(Number);
  return `${Math.round(viewWidth ?? 0)}×${Math.round(viewHeight ?? 0)}`;
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("IceFloorMazePlayView", () => {
  const boardShapeCases = [
    ["1", ["8×8", "8×10"]],
    ["3", ["9×12", "10×13"]],
    ["5", ["12×14"]],
  ] as const;

  describe.each(boardShapeCases)(
    "レベル %s の場合",
    (difficulty, levelShapes) => {
      beforeEach(() => {
        renderAt(`/puzzles/ice-floor-maze/play/${difficulty}`);
      });

      test("問題集からそのレベルの盤面の形の問題を選んでプレイ画面を表示すること", () => {
        const heading = screen.getByRole("heading", {
          name: ICE_FLOOR_MAZE_DISPLAY_NAME,
        });
        const shape = readBoardShape();

        expect(heading).toBeTruthy();
        expect(levelShapes).toContain(shape);
      });
    },
  );

  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/ice-floor-maze/play/1");
    });

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューの難易度変更で難易度選択画面へ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("内部診断を使えないビルドではメニューに検証情報を出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/ice-floor-maze/play/3");
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の盤面の形と分類・計画深さを開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      // 出題した難易度と、分析し直した分類。
      expect(dialog.getAllByText("レベル 3")).toHaveLength(2);
      expect(dialog.getByText(/^(9×12|10×13)$/)).toBeTruthy();
      expect(dialog.getByText(/^3（/)).toBeTruthy();
    });
  });

  const invalidDifficultyCases = ["hard", "6"] as const;

  describe.each(invalidDifficultyCases)("レベルでない %s の場合", (value) => {
    beforeEach(() => {
      renderAt(`/puzzles/ice-floor-maze/play/${value}`);
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/ice-floor-maze");
    });
  });

  describe("問題IDのクエリ", () => {
    const poolProblem = selectIceFloorMazeProblemForDifficulty(
      "5",
      "problem-id-query",
    );
    const poolProblemId = createProblemId(poolProblem.identity);
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderAt("/puzzles/ice-floor-maze/play/1");
      });

      test("出題した問題のIDを履歴を増やさずにURLへ反映すること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toMatch(/^[0-9a-v]{10}$/);
        expect(router.state.historyAction).toBe("REPLACE");
      });
    });

    describe("問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        router = renderAt(
          `/puzzles/ice-floor-maze/play/5?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
      });

      describe("メニューから別の問題を選んだ場合", () => {
        beforeEach(() => {
          openMenu();
        });

        test("URLの問題IDを履歴を増やさずに新しい問題のIDへ置き換えること", () => {
          fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(poolProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
        });
      });
    });

    const unresolvedCases = [
      ["形式の違う問題ID", "5", "invalid"],
      ["別の難易度の問題ID", "4", poolProblemId],
    ] as const;

    describe.each(unresolvedCases)(
      "%sで開いた場合",
      (_, difficulty, requestedProblemId) => {
        beforeEach(() => {
          router = renderAt(
            `/puzzles/ice-floor-maze/play/${difficulty}?problem=${requestedProblemId}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(requestedProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
        });
      },
    );
  });

  describe("直前の問題を避ける location state", () => {
    const firstProblemId = createProblemId(
      selectIceFloorMazeProblemForDifficulty("1", "avoided-first").identity,
    );
    const secondProblemId = createProblemId(
      selectIceFloorMazeProblemForDifficulty("1", "avoided-second").identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("avoided-first")
        .mockReturnValueOnce("avoided-second");
      router = renderAt({
        pathname: "/puzzles/ice-floor-maze/play/1",
        state: createPlayLocationState(firstProblemId),
      });
    });

    test("避ける問題を選ばずに別の問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(secondProblemId).not.toBe(firstProblemId);
      expect(problemId).toBe(secondProblemId);
    });
  });
});
