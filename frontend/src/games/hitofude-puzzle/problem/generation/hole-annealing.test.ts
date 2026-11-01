import {
  _private,
  createHitofudePuzzleHoleBoard,
} from "@/games/hitofude-puzzle/problem/generation/hole-annealing";
import { countHitofudePuzzleHoleLayoutViolations } from "@/games/hitofude-puzzle/problem/generation/hole-layout";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { listHitofudePuzzleBoardSymmetries } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import {
  type HitofudePuzzleBoard,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  areHitofudePuzzleOpenCellsConnected,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";
import { createProblemSeededRandom } from "@/games/problem-seed";

const {
  moveHoles,
  estimateHitofudePuzzleHardness,
  walkHitofudePuzzleHolesTowardHardness,
} = _private;

/** 6×6 の焼きなましと難しさへの歩行は1回に数秒かかる。 */
const GENERATION_TIMEOUT_MS = 60_000;

describe("createHitofudePuzzleHoleBoard", () => {
  const seeds = ["hole-board-a", "hole-board-b", "hole-board-c"];
  const generated = seeds.map((seed) =>
    createHitofudePuzzleHoleBoard(5, 0, createProblemSeededRandom(seed)),
  );
  const regenerated = seeds.map((seed) =>
    createHitofudePuzzleHoleBoard(5, 0, createProblemSeededRandom(seed)),
  );

  test("同じ乱数列から同じ盤面を作ること", () => {
    expect(regenerated).toEqual(generated);
  });

  test("穴が見た目の基準を満たし、返した解だけを解に持つ盤面を作ること", () => {
    const checks = generated.map((result) => {
      const search = countHitofudePuzzleSolutions(result!.board);
      return {
        layoutViolations: countHitofudePuzzleHoleLayoutViolations(
          result!.board,
        ),
        solutionCount: search.solutionCount,
        solved: isHitofudePuzzleSolved(result!.board, result!.solution),
        firstSolution: search.firstSolutions[0],
      };
    });

    expect(checks).toEqual(
      generated.map((result) => ({
        layoutViolations: 0,
        solutionCount: 1,
        solved: true,
        firstSolution: result!.solution,
      })),
    );
  });
});

describe("moveHoles", () => {
  const board = parseHitofudePuzzleBoard([
    ". . # . .",
    ". . . . .",
    "# . S . .",
    ". . . . #",
    ". . . . .",
  ]);
  const random = createProblemSeededRandom("move-holes");
  const moved = Array.from({ length: 200 }, () => moveHoles(board, random));

  test("始点を穴にせず、穴を昇順に保ち、穴でないマスがつながる盤面だけを返すこと", () => {
    const invalid = moved.filter(
      (candidate): candidate is HitofudePuzzleBoard =>
        candidate !== null &&
        (candidate.holes.includes(candidate.start) ||
          candidate.holes.some(
            (hole, index) => index > 0 && candidate.holes[index - 1]! >= hole,
          ) ||
          !areHitofudePuzzleOpenCellsConnected(candidate)),
    );

    expect(invalid).toEqual([]);
  });

  test("穴の数を変える近傍と、始点を動かす近傍を含むこと", () => {
    const changes = new Set(
      moved.flatMap((candidate) =>
        candidate === null
          ? []
          : [
              candidate.holes.length - board.holes.length,
              candidate.start === board.start ? "start-kept" : "start-moved",
            ],
      ),
    );

    expect(changes).toEqual(new Set([-1, 0, 1, "start-kept", "start-moved"]));
  });
});

describe("estimateHitofudePuzzleHardness", () => {
  /** 穴を回り込むしかない、局所の推論だけで決まる盤面。 */
  const forcedBoard = parseHitofudePuzzleBoard(["S . .", "# # .", ". . ."]);
  const { board } = createHitofudePuzzleHoleBoard(
    6,
    0,
    createProblemSeededRandom("estimate-hardness"),
  )!;

  test("一意解の盤面のどの向きからも同じ見積もりを返すこと", () => {
    const estimates = listHitofudePuzzleBoardSymmetries(board).map(
      estimateHitofudePuzzleHardness,
    );

    expect(new Set(estimates).size).toBe(1);
  });

  test("局所の推論だけで解ける盤面を 0 と見積もること", () => {
    const estimate = estimateHitofudePuzzleHardness(forcedBoard);

    expect(estimate).toBe(0);
  });
});

describe("walkHitofudePuzzleHolesTowardHardness", () => {
  const origin = createHitofudePuzzleHoleBoard(
    6,
    0,
    createProblemSeededRandom("walk-origin"),
  )!;
  const originHardness = estimateHitofudePuzzleHardness(origin.board) ?? 0;

  test(
    "同じ乱数列から同じ盤面へ歩き、出発の盤面より易しくない一意解の盤面を返すこと",
    () => {
      const walked = walkHitofudePuzzleHolesTowardHardness(
        origin,
        originHardness + 1,
        createProblemSeededRandom("walk"),
      );
      const rewalked = walkHitofudePuzzleHolesTowardHardness(
        origin,
        originHardness + 1,
        createProblemSeededRandom("walk"),
      );

      expect(rewalked).toEqual(walked);
      expect(
        estimateHitofudePuzzleHardness(walked.board),
      ).toBeGreaterThanOrEqual(originHardness);
      expect(countHitofudePuzzleSolutions(walked.board).solutionCount).toBe(1);
      expect(countHitofudePuzzleHoleLayoutViolations(walked.board)).toBe(0);
      expect(isHitofudePuzzleSolved(walked.board, walked.solution)).toBe(true);
    },
    GENERATION_TIMEOUT_MS,
  );
});
