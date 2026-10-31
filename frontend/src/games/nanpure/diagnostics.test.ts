import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createNanpureDiagnosticSnapshot,
} from "@/games/nanpure/diagnostics";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";

const {
  parseNanpureDiagnosticSnapshot,
  restoreNanpureProblemFromDiagnosticSnapshot,
} = _private;

describe("NanpureDiagnosticSnapshot", () => {
  const selected = selectNanpureProblemForDifficulty("5", "diagnostic-seed");
  const snapshot = createNanpureDiagnosticSnapshot({
    difficulty: "5",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);
    const parsed = parseNanpureDiagnosticSnapshot(serialized);
    const restored = restoreNanpureProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  describe("問題集に無い identity の場合", () => {
    const missing = createNanpureDiagnosticSnapshot({
      difficulty: "1",
      problemIdentity: createNanpureProblemIdentity(
        "hidden-single-block",
        999_999,
      ),
      buildRevision: null,
    });

    test("復元できないこと", () => {
      const restored = restoreNanpureProblemFromDiagnosticSnapshot(missing);

      expect(restored).toBeNull();
    });
  });

  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "takuzu" }],
    ["3段階の難易度", { ...snapshot, difficulty: "normal" }],
    [
      "3段階の生成器の identity",
      {
        ...snapshot,
        problemIdentity: {
          generatorVersion: "1",
          seed: "diagnostic-seed",
          conditions: { clueCount: 32 },
          generationAttempt: 1,
        },
      },
    ],
  ] as const;

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseNanpureDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid nanpure diagnostic snapshot");
  });
});
