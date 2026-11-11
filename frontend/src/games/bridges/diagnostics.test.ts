import {
  _private,
  createBridgesDiagnosticSnapshot,
} from "@/games/bridges/diagnostics";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";

const {
  parseBridgesDiagnosticSnapshot,
  restoreBridgesProblemFromDiagnosticSnapshot,
} = _private;

describe("BridgesDiagnosticSnapshot", () => {
  const selected = selectBridgesProblemForDifficulty("3", "diagnostic-seed");
  const snapshot = createBridgesDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    problem: selected.problem,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const exact = countBridgesSolutions(selected.problem, {
    limit: 2,
    nodeLimit: 200_000,
  });
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "reflection" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    ["同型キーが無い", { ...snapshot, symmetryKey: undefined }],
    ["一意性の結果が欠けた", { ...snapshot, uniqueness: { nodeCount: 1 } }],
    ["正解が数の並びでない", { ...snapshot, solution: ["a"] }],
    ["手詰まりの段が並びでない", { ...snapshot, reasoningRounds: "A1" }],
    ["分析が欠けた", { ...snapshot, difficultyAnalysis: undefined }],
    ["分類が欠けた", { ...snapshot, difficultyAssessment: null }],
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
    const parsed = parseBridgesDiagnosticSnapshot(serialized);
    const restored = restoreBridgesProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("一意解を確かめ、完全解法器が見つけたただ1つの解を持つこと", () => {
    const { uniqueness, solution } = snapshot;

    expect(uniqueness).toMatchObject({
      solutionCount: 1,
      exceededNodeLimit: false,
    });
    expect(solution).toEqual(exact.firstSolution);
  });

  test("問題集の問題を分析し直して、問題集と同じ分析結果とレベルを得ること", () => {
    const { difficultyAnalysis, difficultyAssessment } = snapshot;
    const reasoning =
      difficultyAnalysis.status === "analyzed" &&
      !difficultyAnalysis.requiresTrial
        ? difficultyAnalysis.reasoning
        : null;

    expect(difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
    });
    expect({
      countRoundCount: reasoning?.countRoundCount,
      connectivityRoundCount: reasoning?.connectivityRoundCount,
    }).toEqual({
      countRoundCount: selected.analysis.countRoundCount,
      connectivityRoundCount: selected.analysis.connectivityRoundCount,
    });
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseBridgesDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid bridges diagnostic snapshot");
  });
});
