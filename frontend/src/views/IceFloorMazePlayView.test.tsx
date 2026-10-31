import {
  act,
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
import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  exploreIceFloorMazeStops,
  listIceFloorMazeStopMoves,
} from "@/games/ice-floor-maze/puzzle/stop-graph";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { IceFloorMazePlayView } from "@/views/IceFloorMazePlayView";
import { PlayResultView } from "@/views/PlayResultView";

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
  window.localStorage.clear();
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
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/records", element: <p>記録画面</p> },
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

const arrowKeyByDirection = {
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  left: "ArrowLeft",
} as const satisfies Record<IceFloorMazeDirection, string>;

/** 開始位置からゴールで止まる最少手数の向きの並び。 */
function findSolution({
  board,
  start,
  goal,
}: IceFloorMazeProblem): IceFloorMazeDirection[] {
  const graph = exploreIceFloorMazeStops(board, start);
  const directions: IceFloorMazeDirection[] = [];
  let stop = goal;
  while (stop !== start) {
    const remaining = graph.moveCounts.get(stop)!;
    const previous = graph.stops.find(
      (candidate) =>
        graph.moveCounts.get(candidate) === remaining - 1 &&
        listIceFloorMazeStopMoves(graph, candidate).some(
          (move) => move.to === stop,
        ),
    )!;
    const move = listIceFloorMazeStopMoves(graph, previous).find(
      (candidate) => candidate.to === stop,
    )!;
    directions.unshift(move.direction);
    stop = previous;
  }
  return directions;
}

function slide(directions: readonly IceFloorMazeDirection[]): void {
  for (const direction of directions) {
    fireEvent.keyDown(document.body, { key: arrowKeyByDirection[direction] });
  }
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
      // 方針別の計画深さが同じ値になる問題では、計画深さの表示が複数になるので、問題を固定する。
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue("diagnostics");
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

  describe("通常の出題を解き終えた場合", () => {
    const seed = "ice-floor-maze-play-view";
    const selected = selectIceFloorMazeProblemForDifficulty("1", seed);
    const solution = findSolution(selected.problem);
    let router: PlayRouter;

    beforeEach(async () => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      router = renderAt("/puzzles/ice-floor-maze/play/1");
      slide(solution);
      await screen.findByRole("region", { name: "プレイ結果" });
    });

    test("記録の結果画面へ移り、難易度とスコアを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(router.state.location.pathname).toMatch(
        /^\/puzzles\/ice-floor-maze\/result\//,
      );
      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
      expect(resultScreen.getByText("最短 ±0")).toBeTruthy();
    });

    test("遊んだ問題とプレイの事実と最短手数を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "ice-floor-maze",
        payload: {
          difficulty: "1",
          problemIdentity: selected.identity,
          performance: {
            moveCount: solution.length,
            undoCount: 0,
            restartCount: 0,
            optimalMoveCount: selected.optimalMoveCount,
          },
        },
      });
    });

    test("記録を確認で記録画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

      expect(screen.getByText("記録画面")).toBeTruthy();
    });

    describe("同じ問題を選んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
      });

      test("同じ問題IDのプレイ画面で新しいプレイを始めること", () => {
        const problemId = readProblemId(router);

        expect(router.state.location.pathname).toBe(
          "/puzzles/ice-floor-maze/play/1",
        );
        expect(problemId).toBe(createProblemId(selected.identity));
        expect(screen.getByText("手数").parentElement?.textContent).toBe(
          "手数0",
        );
      });
    });
  });

  describe("途中でプレイを離れた場合", () => {
    beforeEach(async () => {
      renderAt("/puzzles/ice-floor-maze/play/2");
      slide(["up", "left", "down", "right"]);
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));
      await act(async () => {
        await Promise.resolve();
      });
    });

    test("離れた時点までの手数を進み具合として記録すること", () => {
      const [attempt] = readPlayAttempts();

      expect(attempt).toMatchObject({
        gameId: "ice-floor-maze",
        start: { difficulty: "2" },
        abandonment: { progress: { undoCount: 0, restartCount: 0 } },
      });
      expect(attempt?.abandonment?.progress.moveCount).toBeGreaterThan(0);
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
