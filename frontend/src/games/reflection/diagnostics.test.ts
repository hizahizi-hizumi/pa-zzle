import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createReflectionDiagnosticSnapshot,
  parseReflectionDiagnosticSnapshot,
  restoreReflectionProblemFromDiagnosticSnapshot,
} from "@/games/reflection/diagnostics";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";

describe("ReflectionDiagnosticSnapshot", () => {
  const selected = selectReflectionProblemForDifficulty("4", "diagnostic-seed");
  const snapshot = createReflectionDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const missing = createReflectionDiagnosticSnapshot({
    difficulty: "1",
    problemIdentity: createReflectionProblemIdentity(5, 2, 999_999),
    buildRevision: null,
  });
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "takuzu" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "問題集の番号が欠けた",
      { ...snapshot, problemPool: { poolVersion: "1" } },
    ],
    ["分類が欠けた", { ...snapshot, difficultyAssessment: undefined }],
    [
      "扱わない盤面サイズ",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          conditions: { ...snapshot.problemIdentity.conditions, size: 12 },
        },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseReflectionDiagnosticSnapshot(serialized);
    const restored = restoreReflectionProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("出題した問題の問題集の版と番号を持つこと", () => {
    const { problemPool } = snapshot;

    expect(problemPool).toEqual(selected.poolReference);
  });

  test("問題集の問題は、問題集のレベルとそのレベルの推論レベルを分類として持つこと", () => {
    const { difficultyAssessment } = snapshot;

    expect(difficultyAssessment).toEqual({
      status: "classified",
      difficulty: "4",
      reasoningLevel: 4,
    });
  });

  test("問題集に無い 8×8 以上の盤面は分析せず、コピー形式から読み戻せること", () => {
    const sample = createReflectionDiagnosticSnapshot({
      difficulty: "3",
      problemIdentity: createReflectionProblemIdentity(8, 12, 6),
      buildRevision: null,
    });

    const parsed = parseReflectionDiagnosticSnapshot(
      serializeInternalDiagnosticSnapshot(sample),
    );

    expect(sample.difficultyAssessment).toEqual({
      status: "not-analyzed",
      reason: "large-board",
    });
    expect(parsed).toEqual(sample);
  });

  test("問題集に無い 7×7 以下の identity は分析し直して分類すること", () => {
    const { difficultyAssessment } = missing;

    expect(difficultyAssessment.status).not.toBe("not-analyzed");
  });

  test("問題集に無い identity では問題集の番号を持たないこと", () => {
    const { problemPool } = missing;

    expect(problemPool).toBeNull();
  });

  test("問題集に無い identity は復元できないこと", () => {
    const restored = restoreReflectionProblemFromDiagnosticSnapshot(missing);

    expect(restored).toBeNull();
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseReflectionDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid Reflection diagnostic snapshot");
  });
});
