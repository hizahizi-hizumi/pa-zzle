import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createReflectionDiagnosticSnapshot,
} from "@/games/reflection/diagnostics";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";

const {
  parseReflectionDiagnosticSnapshot,
  restoreReflectionProblemFromDiagnosticSnapshot,
} = _private;

describe("ReflectionDiagnosticSnapshot", () => {
  const selected = selectReflectionProblemForDifficulty("4", "diagnostic-seed");
  const snapshot = createReflectionDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: selected.identity,
    poolReference: selected.poolReference,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "takuzu" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "問題集の番号が欠けた",
      { ...snapshot, problemPool: { poolVersion: "1" } },
    ],
    ["問題集の版と番号が無い", { ...snapshot, problemPool: null }],
    ["分類が欠けた", { ...snapshot, difficultyAssessment: undefined }],
    [
      "分類されていない",
      { ...snapshot, difficultyAssessment: { status: "unsupported" } },
    ],
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

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseReflectionDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid reflection diagnostic snapshot");
  });
});
