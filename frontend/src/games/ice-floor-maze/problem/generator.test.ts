// @vitest-environment node

import type { ElementRecipe } from "@/games/ice-floor-maze/problem/generation/element-objective";
import { fullElementSearch } from "@/games/ice-floor-maze/problem/generation/element-search";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import { createTacticWeights } from "@/games/ice-floor-maze/problem/generation/tactic-search";
import {
  generateIceFloorMazeProblem,
  type IceFloorMazeGenerationRecipe,
} from "@/games/ice-floor-maze/problem/generator";
import {
  assertIceFloorMazeProblem,
  createIceFloorMazeProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";

const tacticRecipe: IceFloorMazeGenerationRecipe = {
  kind: "tactics",
  recipe: {
    width: 8,
    height: 8,
    shortest: { minimum: 6, maximum: 9 },
    weights: createTacticWeights(["stopper"], ["trap-lure"]),
    iterations: 60,
    maximumRockDensity: 0.34,
  },
};

const elementRecipe: ElementRecipe = {
  variant: "thin-ice",
  width: 8,
  height: 8,
  shortest: { minimum: 8, maximum: 12 },
  elements: { minimum: 3, maximum: 4 },
  minimumEach: 0,
  minimumUses: 3,
  decoyShare: 0.2,
  forcedShare: 0.25,
  maximumRockDensity: 0.3,
};

describe("generateIceFloorMazeProblem", () => {
  const recipes = [
    ["氷と岩だけの山登り", tacticRecipe, "none"],
    [
      "薄い氷を置く山登り",
      {
        kind: "elements",
        recipe: elementRecipe,
        search: { ...fullElementSearch, iterations: 30 },
      },
      "thin-ice",
    ],
  ] as const satisfies readonly (readonly [
    string,
    IceFloorMazeGenerationRecipe,
    string,
  ])[];

  test.each(recipes)(
    "%s で、盤面の外を切り落とした遊べる問題と、その分析・identity・正規化キーを返すこと",
    (_, recipe, composition) => {
      const generated = generateIceFloorMazeProblem(recipe, "generator-test")!;

      function act() {
        assertIceFloorMazeProblem(generated.problem);
      }

      expect(act).not.toThrow();
      expect(generated.analysis).toMatchObject({
        status: "analyzed",
        composition,
        features: { optimalMoveCount: generated.optimalMoveCount },
      });
      expect(generated.identity).toEqual(
        createIceFloorMazeProblemIdentity(generated.problem),
      );
      expect(generated.symmetryKey).toBe(
        getIceFloorMazeSymmetryKey(generated.problem),
      );
      expect(generated.problem.board.width).toBeLessThanOrEqual(
        generated.problem.board.height,
      );
    },
  );

  test.each(recipes)(
    "%s で、同じ条件と seed から同じ問題を作ること",
    (_, recipe) => {
      const first = generateIceFloorMazeProblem(recipe, "same-seed");
      const second = generateIceFloorMazeProblem(recipe, "same-seed");

      expect(second?.identity).toEqual(first?.identity);
    },
  );

  describe("採用条件を満たした時点で打ち切る方式で、条件を満たさないまま諦める回数に達した場合", () => {
    const recipe: IceFloorMazeGenerationRecipe = {
      kind: "elements",
      recipe: elementRecipe,
      search: {
        iterations: 3000,
        stopWhenAccepted: true,
        minimumHardness: Number.POSITIVE_INFINITY,
        giveUpAfter: 5,
      },
    };

    test("問題を作らないこと", () => {
      const generated = generateIceFloorMazeProblem(recipe, "give-up");

      expect(generated).toBeNull();
    });
  });
});
