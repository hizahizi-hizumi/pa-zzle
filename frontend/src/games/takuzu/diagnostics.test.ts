import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createTakuzuDiagnosticSnapshot,
  parseTakuzuDiagnosticSnapshot,
  restoreTakuzuProblemFromDiagnosticSnapshot,
} from "@/games/takuzu/diagnostics";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";

describe("TakuzuDiagnosticSnapshot", () => {
  const selected = selectTakuzuProblemForDifficulty("4", "diagnostic-seed");
  const snapshot = createTakuzuDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);
    const parsed = parseTakuzuDiagnosticSnapshot(serialized);
    const restored = restoreTakuzuProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("問題集に無い identity は復元できないこと", () => {
    const missing = createTakuzuDiagnosticSnapshot({
      difficulty: "1",
      problemIdentity: createTakuzuProblemIdentity("adjacency", 0, 999_999),
      buildRevision: null,
    });

    const restored = restoreTakuzuProblemFromDiagnosticSnapshot(missing);

    expect(restored).toBeNull();
  });

  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "nanpure" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "未知の手筋の上限",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          conditions: {
            ...snapshot.problemIdentity.conditions,
            removalTechniqueLimit: "guess",
          },
        },
      },
    ],
  ] as const;

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseTakuzuDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid Takuzu diagnostic snapshot");
  });
});
