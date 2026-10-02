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
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";
import { readPlayRecords } from "@/records/storage";
import { PlayResultView } from "@/views/PlayResultView";
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

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/slide-puzzle/play/:difficulty",
        element: <SlidePuzzlePlayView />,
      },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function readProblemId(router: PlayRouter): string | null {
  return new URLSearchParams(router.state.location.search).get("problem");
}

describe("SlidePuzzlePlayView", () => {
  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      selectSlidePuzzleProblemForDifficulty("1", "problem-id-query").identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/slide-puzzle/play/1");
      });

      test("出題した問題のIDを履歴を増やさずにURLへ反映すること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toMatch(/^[0-9a-v]{10}$/);
        expect(router.state.historyAction).toBe("REPLACE");
      });
    });

    describe("問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt(
          `/puzzles/slide-puzzle/play/1?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
      });
    });

    const unresolvedCases = [
      ["形式の違う問題ID", "1", "invalid"],
      ["別の難易度の問題ID", "2", poolProblemId],
    ] as const;

    describe.each(unresolvedCases)(
      "%sで開いた場合",
      (_, difficulty, requestedProblemId) => {
        beforeEach(() => {
          router = renderRouterAt(
            `/puzzles/slide-puzzle/play/${difficulty}?problem=${requestedProblemId}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(requestedProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
          expect(screen.queryByText(/選べません|復元できません/)).toBeNull();
        });
      },
    );
  });
});

/** 幅優先探索で、盤面を完成させるまでに動かすタイルの番号を順に求める。 */
function findSolvingTiles(initialBoard: SlidePuzzleBoard): number[] {
  const previous = new Map<string, { key: string; tile: number } | null>([
    [initialBoard.join(","), null],
  ]);
  const queue = [initialBoard];
  for (const board of queue) {
    if (isSlidePuzzleSolved(board)) {
      const tiles: number[] = [];
      for (
        let step = previous.get(board.join(","));
        step;
        step = previous.get(step.key)
      ) {
        tiles.unshift(step.tile);
      }
      return tiles;
    }
    for (const cellIndex of listSlidePuzzleSingleMoves(board)) {
      const slide = getSlidePuzzleSlide(board, cellIndex);
      const next = slide ? applySlidePuzzleSlide(board, slide) : board;
      const nextKey = next.join(",");
      if (!previous.has(nextKey)) {
        previous.set(nextKey, {
          key: board.join(","),
          tile: board[cellIndex] as number,
        });
        queue.push(next);
      }
    }
  }
  throw new Error("Slide puzzle board must be solvable");
}

describe("解き終えた場合", () => {
  const { problem, identity } = selectSlidePuzzleProblemForDifficulty(
    "1",
    "solve",
  );
  const solvingTiles = findSolvingTiles(problem.initialBoard);
  let router: PlayRouter;

  beforeEach(() => {
    router = renderRouterAt(
      `/puzzles/slide-puzzle/play/1?problem=${createProblemId(identity)}`,
    );
    for (const tile of solvingTiles) {
      fireEvent.click(
        within(screen.getByRole("group", { name: "盤面" })).getByText(
          String(tile),
        ),
      );
    }
  });

  test("保存した記録の結果画面へ履歴を置き換えて移ること", async () => {
    const resultScreen = await screen.findByRole("region", {
      name: "プレイ結果",
    });
    const [record] = readPlayRecords();

    expect(resultScreen).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      `/puzzles/slide-puzzle/result/${encodeURIComponent(record?.id ?? "")}`,
    );
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual({
      recordSaveOutcome: { status: "first-record" },
    });
  });
});

describe("直前の問題を避ける location state", () => {
  const firstProblem = selectSlidePuzzleProblemForDifficulty(
    "1",
    "avoided-first",
  );
  const secondProblem = selectSlidePuzzleProblemForDifficulty(
    "1",
    "avoided-second",
  );
  const firstProblemId = createProblemId(firstProblem.identity);
  const secondProblemId = createProblemId(secondProblem.identity);
  const state = createPlayLocationState(firstProblemId);
  let router: PlayRouter;

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("avoided-first")
      .mockReturnValueOnce("avoided-second");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("問題IDの無いURLで開いた場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/slide-puzzle/play/1",
        state,
      });
    });

    test("避ける問題を選ばずに別の問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(secondProblemId).not.toBe(firstProblemId);
      expect(problemId).toBe(secondProblemId);
    });
  });

  describe("避ける問題をURLの問題IDでも指定した場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/slide-puzzle/play/1",
        search: `?problem=${firstProblemId}`,
        state,
      });
    });

    test("URLで指定した問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(problemId).toBe(firstProblemId);
      expect(router.state.historyAction).toBe("POP");
    });
  });
});
