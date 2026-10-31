import { isInNumericRange } from "@/games/difficulty";
import {
  listIceFloorMazeRelevantRocks,
  removeIceFloorMazeIrrelevantRocks,
} from "@/games/ice-floor-maze/problem/generation/relevant-rocks";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import {
  generateIceFloorMazeBoardCandidate,
  generateIceFloorMazeProblem,
  iceFloorMazeOptimalMoveCountRange,
} from "@/games/ice-floor-maze/problem/generator";
import {
  assertIceFloorMazeProblem,
  restoreIceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";
import { createProblemSeededRandom } from "@/games/problem-seed";

describe("generateIceFloorMazeProblem", () => {
  const shapes = [
    { width: 8, height: 8 },
    { width: 9, height: 12 },
    { width: 12, height: 14 },
  ];
  const seeds = Array.from({ length: 10 }, (_, index) => `test-${index}`);
  const cases = shapes.flatMap((shape) =>
    seeds.map((seed) => ({ shape, seed })),
  );

  test.each(cases)(
    "$shape.width×$shape.height・$seed で、盤面の形どおりの成立した問題を作ること",
    ({ shape, seed }) => {
      const { problem } = generateIceFloorMazeProblem(seed, shape);

      expect(() => assertIceFloorMazeProblem(problem)).not.toThrow();
      expect(problem.board.width).toBe(shape.width);
      expect(problem.board.height).toBe(shape.height);
    },
  );

  test.each(cases)(
    "$shape.width×$shape.height・$seed で、最少手数が提供範囲に入り、BFS の最少手数と一致すること",
    ({ shape, seed }) => {
      const generated = generateIceFloorMazeProblem(seed, shape);

      const { problem } = generated;
      const bfsMoveCount = exploreIceFloorMazeStops(
        problem.board,
        problem.start,
      ).moveCounts.get(problem.goal);

      expect(generated.optimalMoveCount).toBe(bfsMoveCount);
      expect(
        isInNumericRange(
          generated.optimalMoveCount,
          iceFloorMazeOptimalMoveCountRange,
        ),
      ).toBe(true);
    },
  );

  test.each(cases)(
    "$shape.width×$shape.height・$seed で、無関係な岩の無い盤面にすること",
    ({ shape, seed }) => {
      const { problem } = generateIceFloorMazeProblem(seed, shape);

      const normalizedBoard = removeIceFloorMazeIrrelevantRocks(
        problem.board,
        problem.start,
      );

      expect(normalizedBoard).toEqual(problem.board);
    },
  );

  test.each(cases)(
    "$shape.width×$shape.height・$seed で、identity から同じ問題を復号でき、同型判定キーを添えること",
    ({ shape, seed }) => {
      const generated = generateIceFloorMazeProblem(seed, shape);

      const restored = restoreIceFloorMazeProblem(generated.identity);

      expect(restored.problem).toEqual(generated.problem);
      expect(generated.identity.conditions).toEqual(shape);
      expect(generated.symmetryKey).toBe(
        getIceFloorMazeSymmetryKey(generated.problem),
      );
    },
  );

  describe("同じ seed と形の場合", () => {
    const shape = { width: 9, height: 12 };

    test("同じ問題を作ること", () => {
      const first = generateIceFloorMazeProblem("same", shape);
      const second = generateIceFloorMazeProblem("same", { ...shape });

      expect(second).toEqual(first);
    });
  });

  describe("違う seed の場合", () => {
    const shape = { width: 8, height: 8 };

    test("違う問題を作ること", () => {
      const first = generateIceFloorMazeProblem("first", shape);
      const second = generateIceFloorMazeProblem("second", shape);

      expect(second.identity).not.toEqual(first.identity);
    });
  });

  const unsupportedShapes = [
    ["横長", { width: 10, height: 8 }],
    ["最も広い形より広い", { width: 12, height: 16 }],
  ] as const;

  test.each(unsupportedShapes)("%sの盤面を拒否すること", (_, shape) => {
    function act() {
      generateIceFloorMazeProblem("seed", shape);
    }

    expect(act).toThrow();
  });
});

describe("generateIceFloorMazeBoardCandidate", () => {
  const shape = { width: 10, height: 13 };

  describe("固定の乱数列の場合", () => {
    let random: () => number;

    beforeEach(() => {
      random = createProblemSeededRandom("candidate");
    });

    test("ゴールの候補を、開始位置からの最少手数が提供範囲に入る停止点だけからマスの番号の昇順に並べること", () => {
      const candidate = generateIceFloorMazeBoardCandidate(shape, random);

      const moveCounts = candidate
        ? exploreIceFloorMazeStops(candidate.board, candidate.start).moveCounts
        : new Map<number, number>();
      const expectedGoals = [...moveCounts]
        .filter(([, moveCount]) =>
          isInNumericRange(moveCount, iceFloorMazeOptimalMoveCountRange),
        )
        .map(([goal, optimalMoveCount]) => ({ goal, optimalMoveCount }))
        .sort((left, right) => left.goal - right.goal);

      expect(candidate?.goalCandidates).toEqual(expectedGoals);
      expect(candidate?.goalCandidates.length).toBeGreaterThan(0);
    });

    test("開始位置から到達できる停止点の滑りに関わる岩だけを残すこと", () => {
      const candidate = generateIceFloorMazeBoardCandidate(shape, random);

      const rocks = candidate?.board.cells.flatMap((cell, cellIndex) =>
        cell === "rock" ? [cellIndex] : [],
      );
      const relevantRocks = candidate
        ? listIceFloorMazeRelevantRocks(
            candidate.board,
            exploreIceFloorMazeStops(candidate.board, candidate.start),
          )
        : [];

      expect(rocks).toEqual(relevantRocks);
    });
  });
});
