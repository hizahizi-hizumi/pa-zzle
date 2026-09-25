import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createFifteenPuzzleDiagnosticSnapshot,
  parseFifteenPuzzleDiagnosticSnapshot,
  restoreFifteenPuzzleProblemFromDiagnosticSnapshot,
} from "@/games/fifteen-puzzle/diagnostics";
import { selectFifteenPuzzleProblemForDifficulty } from "@/games/fifteen-puzzle/problem-selection";

describe("FifteenPuzzleDiagnosticSnapshot", () => {
  const problem = selectFifteenPuzzleProblemForDifficulty(
    "3",
    "diagnostic-reproduction-seed",
  );
  const snapshot = createFifteenPuzzleDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: problem.identity,
    buildRevision: "abcdef1234567890",
  });
  const invalidSerialized = [
    JSON.stringify({ ...snapshot, formatVersion: 2 }),
    JSON.stringify({ ...snapshot, game: "water-sort" }),
    JSON.stringify({ ...snapshot, difficulty: "normal" }),
    JSON.stringify({
      ...snapshot,
      problemIdentity: { ...snapshot.problemIdentity, generatorVersion: "2" },
    }),
  ];

  test("コピー形式を復元して同じ初期盤面と最短手数を再現できること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);
    const parsed = parseFifteenPuzzleDiagnosticSnapshot(serialized);
    const restored = restoreFifteenPuzzleProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem.initialBoard).toEqual(
      problem.problem.initialBoard,
    );
    expect(restored?.optimalMoveCount).toBe(problem.optimalMoveCount);
  });

  test.each(invalidSerialized)(
    "診断形式ではないJSONを拒否すること: %s",
    (serialized) => {
      const act = () => parseFifteenPuzzleDiagnosticSnapshot(serialized);

      expect(act).toThrow("Invalid fifteen puzzle diagnostic snapshot");
    },
  );
});
