import {
  _private,
  createHamiltonianPathHoleBoard,
} from "@/games/hamiltonian-path/problem/generation/hole-annealing";
import { countHamiltonianPathHoleLayoutViolations } from "@/games/hamiltonian-path/problem/generation/hole-layout";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { listHamiltonianPathBoardSymmetries } from "@/games/hamiltonian-path/problem/generation/symmetry";
import {
  type HamiltonianPathBoard,
  parseHamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  areHamiltonianPathOpenCellsConnected,
  isHamiltonianPathSolved,
} from "@/games/hamiltonian-path/puzzle/rules";
import { createProblemSeededRandom } from "@/games/problem-seed";

const {
  moveHoles,
  estimateHamiltonianPathHardness,
  walkHamiltonianPathHolesTowardHardness,
} = _private;

/** 6×6 の焼きなましと難しさへの歩行は1回に数秒かかる。 */
const GENERATION_TIMEOUT_MS = 60_000;

describe("createHamiltonianPathHoleBoard", () => {
  const seeds = ["hole-board-a", "hole-board-b", "hole-board-c"];
  const generated = seeds.map((seed) =>
    createHamiltonianPathHoleBoard(5, 0, createProblemSeededRandom(seed)),
  );
  const regenerated = seeds.map((seed) =>
    createHamiltonianPathHoleBoard(5, 0, createProblemSeededRandom(seed)),
  );

  test("同じ乱数列から同じ盤面を作ること", () => {
    expect(regenerated).toEqual(generated);
  });

  test("穴が見た目の基準を満たし、返した解だけを解に持つ盤面を作ること", () => {
    const checks = generated.map((result) => {
      const search = countHamiltonianPathSolutions(result!.board);
      return {
        layoutViolations: countHamiltonianPathHoleLayoutViolations(
          result!.board,
        ),
        solutionCount: search.solutionCount,
        solved: isHamiltonianPathSolved(result!.board, result!.solution),
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
  const board = parseHamiltonianPathBoard([
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
      (candidate): candidate is HamiltonianPathBoard =>
        candidate !== null &&
        (candidate.holes.includes(candidate.start) ||
          candidate.holes.some(
            (hole, index) => index > 0 && candidate.holes[index - 1]! >= hole,
          ) ||
          !areHamiltonianPathOpenCellsConnected(candidate)),
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

describe("estimateHamiltonianPathHardness", () => {
  /** 穴を回り込むしかない、局所の推論だけで決まる盤面。 */
  const forcedBoard = parseHamiltonianPathBoard(["S . .", "# # .", ". . ."]);
  const { board } = createHamiltonianPathHoleBoard(
    6,
    0,
    createProblemSeededRandom("estimate-hardness"),
  )!;

  test("一意解の盤面のどの向きからも同じ見積もりを返すこと", () => {
    const estimates = listHamiltonianPathBoardSymmetries(board).map(
      estimateHamiltonianPathHardness,
    );

    expect(new Set(estimates).size).toBe(1);
  });

  test("局所の推論だけで解ける盤面を 0 と見積もること", () => {
    const estimate = estimateHamiltonianPathHardness(forcedBoard);

    expect(estimate).toBe(0);
  });
});

describe("walkHamiltonianPathHolesTowardHardness", () => {
  const origin = createHamiltonianPathHoleBoard(
    6,
    0,
    createProblemSeededRandom("walk-origin"),
  )!;
  const originHardness = estimateHamiltonianPathHardness(origin.board) ?? 0;

  test(
    "同じ乱数列から同じ盤面へ歩き、出発の盤面より易しくない一意解の盤面を返すこと",
    () => {
      const walked = walkHamiltonianPathHolesTowardHardness(
        origin,
        originHardness + 1,
        createProblemSeededRandom("walk"),
      );
      const rewalked = walkHamiltonianPathHolesTowardHardness(
        origin,
        originHardness + 1,
        createProblemSeededRandom("walk"),
      );

      expect(rewalked).toEqual(walked);
      expect(
        estimateHamiltonianPathHardness(walked.board),
      ).toBeGreaterThanOrEqual(originHardness);
      expect(countHamiltonianPathSolutions(walked.board).solutionCount).toBe(1);
      expect(countHamiltonianPathHoleLayoutViolations(walked.board)).toBe(0);
      expect(isHamiltonianPathSolved(walked.board, walked.solution)).toBe(true);
    },
    GENERATION_TIMEOUT_MS,
  );
});
