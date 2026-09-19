import { generateWaterSortProblem } from "@/games/water-sort/problem/generator";

import {
  createWaterSortDiagnosticSnapshot,
  parseWaterSortDiagnosticSnapshot,
  restoreWaterSortProblemFromDiagnosticSnapshot,
  serializeWaterSortDiagnosticSnapshot,
} from "./diagnostics";

describe("WaterSortDiagnosticSnapshot", () => {
  test("コピー形式を復元して同じ初期問題を再現できること", () => {
    const problem = generateWaterSortProblem({
      seed: "diagnostic-reproduction-seed",
      colorCount: 4,
    });
    const snapshot = createWaterSortDiagnosticSnapshot({
      difficulty: "normal",
      problemIdentity: {
        generatorVersion: problem.identity.generatorVersion,
        seed: problem.identity.seed,
        conditions: problem.identity.conditions,
        generationAttempt: problem.identity.generationAttempt,
      },
      buildRevision: "abcdef1234567890",
    });

    const serialized = serializeWaterSortDiagnosticSnapshot(snapshot);
    const parsed = parseWaterSortDiagnosticSnapshot(serialized);
    const restored = restoreWaterSortProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem.initialState).toEqual(problem.problem.initialState);
    expect(restored.optimalMoveCount).toBe(problem.optimalMoveCount);
    expect(restored.difficultyAnalysis).toEqual(problem.difficultyAnalysis);
  });

  test("診断形式ではないJSONを拒否すること", () => {
    const serialized = JSON.stringify({
      formatVersion: 2,
      game: "water-sort",
    });

    function act() {
      return parseWaterSortDiagnosticSnapshot(serialized);
    }

    expect(act).toThrow("Invalid water sort diagnostic snapshot");
  });
});
