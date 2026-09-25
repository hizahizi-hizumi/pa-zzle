import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createNanpureDiagnosticSnapshot,
  parseNanpureDiagnosticSnapshot,
  restoreNanpureProblemFromDiagnosticSnapshot,
} from "@/games/nanpure/diagnostics";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";

describe("NanpureDiagnosticSnapshot", () => {
  const problem = generateNanpureProblem({
    seed: "diagnostic-reproduction-seed",
    clueCount: 32,
  });
  const snapshot = createNanpureDiagnosticSnapshot({
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: problem.identity.generatorVersion,
      seed: problem.identity.seed,
      conditions: problem.identity.conditions,
      generationAttempt: problem.identity.generationAttempt,
    },
    buildRevision: "abcdef1234567890",
  });
  const invalidSerialized = JSON.stringify({
    formatVersion: 2,
    game: "nanpure",
  });

  test("コピー形式を復元して同じ初期問題を再現できること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);
    const parsed = parseNanpureDiagnosticSnapshot(serialized);
    const restored = restoreNanpureProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.clues).toEqual(problem.clues);
    expect(restored.solution).toEqual(problem.solution);
    expect(restored.difficultyAnalysis).toEqual(problem.difficultyAnalysis);
  });

  test("診断形式ではないJSONを拒否すること", () => {
    function act() {
      return parseNanpureDiagnosticSnapshot(invalidSerialized);
    }

    expect(act).toThrow("Invalid Nanpure diagnostic snapshot");
  });
});
