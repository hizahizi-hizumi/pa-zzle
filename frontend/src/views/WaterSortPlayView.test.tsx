import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router";
import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { solveWaterSort } from "@/games/water-sort/problem/generation/solver";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import { readPlayRecords } from "@/records/storage";
import { PlayResultView } from "@/views/PlayResultView";
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

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/water-sort/play/:difficulty",
        element: <WaterSortPlayView />,
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

describe("WaterSortPlayView", () => {
  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      selectWaterSortProblemForDifficulty("1", "problem-id-query").identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/water-sort/play/1");
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
          `/puzzles/water-sort/play/1?problem=${poolProblemId}`,
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
            `/puzzles/water-sort/play/${difficulty}?problem=${requestedProblemId}`,
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

describe("解き終えた場合", () => {
  const { problem, identity } = selectWaterSortProblemForDifficulty(
    "1",
    "solve",
  );
  const { moves } = solveWaterSort(problem.initialState);
  let router: PlayRouter;

  function pressBottle(bottleIndex: number): void {
    fireEvent.click(
      screen.getByLabelText(new RegExp(`^ボトル ${bottleIndex + 1}:`)),
    );
  }

  beforeEach(() => {
    router = renderRouterAt(
      `/puzzles/water-sort/play/1?problem=${createProblemId(identity)}`,
    );
    for (const move of moves) {
      pressBottle(move.sourceBottleIndex);
      pressBottle(move.destinationBottleIndex);
    }
  });

  test("保存した記録の結果画面へ履歴を置き換えて移ること", async () => {
    const resultScreen = await screen.findByRole("region", {
      name: "プレイ結果",
    });
    const [record] = readPlayRecords();

    expect(resultScreen).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      `/puzzles/water-sort/result/${encodeURIComponent(record?.id ?? "")}`,
    );
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual({
      recordSaveOutcome: { status: "first-record" },
    });
  });
});

describe("直前の問題を避ける location state", () => {
  const firstProblem = selectWaterSortProblemForDifficulty(
    "1",
    "avoided-first",
  );
  const secondProblem = selectWaterSortProblemForDifficulty(
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
        pathname: "/puzzles/water-sort/play/1",
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
        pathname: "/puzzles/water-sort/play/1",
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
