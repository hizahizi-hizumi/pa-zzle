import { countHitofudePuzzleHoleLayoutViolations } from "@/games/hitofude-puzzle/problem/generation/hole-layout";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { getHitofudePuzzleSymmetryKey } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import {
  assertHitofudePuzzleProblem,
  createHitofudePuzzleProblemIdentity,
  type HitofudePuzzleProblemIdentity,
  hitofudePuzzleBoardSizes,
} from "@/games/hitofude-puzzle/problem/problem";
import { isHitofudePuzzleSolved } from "@/games/hitofude-puzzle/puzzle/rules";

/** 8×8 の焼きなましと 7×7 の難しさへの歩行は1問に数秒かかる。 */
const GENERATION_TIMEOUT_MS = 60_000;

describe("generateHitofudePuzzleProblem", () => {
  const conditions = [
    ...hitofudePuzzleBoardSizes.map((size) => [size, 0] as const),
    [7, 4] as const,
  ];
  const identity = createHitofudePuzzleProblemIdentity(6, 0, 0);

  test.each(conditions)(
    "一辺 %i・先読みの重さの目標 %i で、穴が見た目の基準を満たす一意解の問題を作ること",
    (size, targetLookaheadLoad) => {
      const { problem, solution } = generateHitofudePuzzleProblem(
        createHitofudePuzzleProblemIdentity(size, targetLookaheadLoad, 0),
      );
      const search = countHitofudePuzzleSolutions(problem);
      const assertProblem = () => assertHitofudePuzzleProblem(problem);

      expect(assertProblem).not.toThrow();
      expect(problem.size).toBe(size);
      expect(countHitofudePuzzleHoleLayoutViolations(problem)).toBe(0);
      expect(isHitofudePuzzleSolved(problem, solution)).toBe(true);
      expect(search.status).toBe("complete");
      expect(search.solutionCount).toBe(1);
      expect(search.firstSolutions[0]).toEqual(solution);
    },
    GENERATION_TIMEOUT_MS,
  );

  test("問題の同型判定キーを返すこと", () => {
    const generated = generateHitofudePuzzleProblem(identity);

    expect(generated.symmetryKey).toBe(
      getHitofudePuzzleSymmetryKey(generated.problem),
    );
  });

  test("同じ identity から同じ問題を作り、identity をそのまま返すこと", () => {
    const first = generateHitofudePuzzleProblem(identity);
    const second = generateHitofudePuzzleProblem(structuredClone(identity));

    expect(second.problem).toEqual(first.problem);
    expect(second.identity).toEqual(identity);
  });

  test("seed が違えば別の問題を作ること", () => {
    const first = generateHitofudePuzzleProblem(identity);
    const other = generateHitofudePuzzleProblem(
      createHitofudePuzzleProblemIdentity(6, 0, 1),
    );

    expect(other.problem).not.toEqual(first.problem);
  });

  const invalidIdentities: readonly [string, HitofudePuzzleProblemIdentity][] =
    [
      [
        "対応していない生成器の版",
        {
          ...identity,
          generatorVersion:
            "1" as HitofudePuzzleProblemIdentity["generatorVersion"],
        },
      ],
      [
        "対応していない盤面の大きさ",
        {
          ...identity,
          conditions: {
            size: 10 as HitofudePuzzleProblemIdentity["conditions"]["size"],
            targetLookaheadLoad: 0,
          },
        },
      ],
      [
        "対応していない先読みの重さの目標",
        {
          ...identity,
          conditions: {
            size: 6,
            targetLookaheadLoad:
              5 as HitofudePuzzleProblemIdentity["conditions"]["targetLookaheadLoad"],
          },
        },
      ],
    ];

  test.each(invalidIdentities)("%s を拒否すること", (_, invalidIdentity) => {
    const act = () => generateHitofudePuzzleProblem(invalidIdentity);

    expect(act).toThrow();
  });
});
