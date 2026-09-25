import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createSlidePuzzleDiagnosticSnapshot,
} from "@/games/slide-puzzle/diagnostics";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";

const {
  parseSlidePuzzleDiagnosticSnapshot,
  restoreSlidePuzzleProblemFromDiagnosticSnapshot,
} = _private;

describe("SlidePuzzleDiagnosticSnapshot", () => {
  const problem = selectSlidePuzzleProblemForDifficulty(
    "3",
    "diagnostic-reproduction-seed",
  );
  const snapshot = createSlidePuzzleDiagnosticSnapshot({
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
    const parsed = parseSlidePuzzleDiagnosticSnapshot(serialized);
    const restored = restoreSlidePuzzleProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem.initialBoard).toEqual(
      problem.problem.initialBoard,
    );
    expect(restored?.optimalMoveCount).toBe(problem.optimalMoveCount);
  });

  test.each(invalidSerialized)(
    "診断形式ではないJSONを拒否すること: %s",
    (serialized) => {
      const act = () => parseSlidePuzzleDiagnosticSnapshot(serialized);

      expect(act).toThrow("Invalid slide puzzle diagnostic snapshot");
    },
  );
});
