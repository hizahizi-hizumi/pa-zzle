import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createNonogramDiagnosticSnapshot,
} from "@/games/nonogram/diagnostics";
import {
  createNonogramProblemIdentity,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";

const {
  parseNonogramDiagnosticSnapshot,
  restoreNonogramProblemFromDiagnosticSnapshot,
} = _private;

describe("NonogramDiagnosticSnapshot", () => {
  const selected = selectNonogramProblemForDifficulty("4", "diagnostic-seed");
  const snapshot = createNonogramDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);
    const parsed = parseNonogramDiagnosticSnapshot(serialized);
    const restored = restoreNonogramProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("問題集に無い identity は復元できないこと", () => {
    const missing = createNonogramDiagnosticSnapshot({
      difficulty: "1",
      problemIdentity: createNonogramProblemIdentity(
        { width: 7, height: 7 },
        nonogramPatternStyles[0]!,
        999_999,
      ),
      buildRevision: null,
    });

    const restored = restoreNonogramProblemFromDiagnosticSnapshot(missing);

    expect(restored).toBeNull();
  });

  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "takuzu" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "未知の盤面の大きさ",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          conditions: { ...snapshot.problemIdentity.conditions, width: 15 },
        },
      },
    ],
  ] as const;

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseNonogramDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid nonogram diagnostic snapshot");
  });
});
