import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createFukumenzanDiagnosticSnapshot,
} from "@/games/fukumenzan/diagnostics";
import { selectFukumenzanProblemForDifficulty } from "@/games/fukumenzan/problem-selection";

const {
  parseFukumenzanDiagnosticSnapshot,
  restoreFukumenzanProblemFromDiagnosticSnapshot,
} = _private;

describe("FukumenzanDiagnosticSnapshot", () => {
  const selected = selectFukumenzanProblemForDifficulty("3", "diagnostic-seed");
  const snapshot = createFukumenzanDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["別のゲーム", { ...snapshot, game: "bridges" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "式と合わない条件",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          conditions: { addendLengths: [9] },
        },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseFukumenzanDiagnosticSnapshot(serialized);
    const restored = restoreFukumenzanProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseFukumenzanDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid fukumenzan diagnostic snapshot");
  });
});
