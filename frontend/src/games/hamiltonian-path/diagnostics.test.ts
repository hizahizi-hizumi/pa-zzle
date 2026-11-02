import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createHamiltonianPathDiagnosticSnapshot,
} from "@/games/hamiltonian-path/diagnostics";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";

const {
  parseHamiltonianPathDiagnosticSnapshot,
  restoreHamiltonianPathProblemFromDiagnosticSnapshot,
} = _private;

describe("HamiltonianPathDiagnosticSnapshot", () => {
  const selected = selectHamiltonianPathProblemForDifficulty(
    "3",
    "diagnostic-seed",
  );
  const snapshot = createHamiltonianPathDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    problem: selected.problem,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "reflection" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    ["同型キーが無い", { ...snapshot, symmetryKey: undefined }],
    [
      "一意性の結果が欠けた",
      { ...snapshot, uniqueness: { status: "complete" } },
    ],
    ["正解の道が数の並びでない", { ...snapshot, solution: ["a"] }],
    ["直進率が負", { ...snapshot, straightRatio: -1 }],
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
    const parsed = parseHamiltonianPathDiagnosticSnapshot(serialized);
    const restored =
      restoreHamiltonianPathProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("一意解を確かめ、生成器と同じ正解の道を持つこと", () => {
    const { solution } = generateHamiltonianPathProblem(selected.identity);

    expect(snapshot.uniqueness).toMatchObject({
      status: "complete",
      solutionCount: 1,
    });
    expect(snapshot.solution).toEqual(solution);
  });

  test("問題集の問題を分析し直して、問題集と同じ作業の量とレベルを得ること", () => {
    const { difficultyAnalysis, difficultyAssessment } = snapshot;

    expect(difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
    });
    expect(difficultyAnalysis).toMatchObject({
      status: "analyzed",
      scale: { openCellCount: selected.workload.openCellCount },
      reasoning: { assumptionCount: selected.workload.assumptionCount },
      drawing: { fatalBranchCount: selected.workload.fatalBranchCount },
    });
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseHamiltonianPathDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid hamiltonian-path diagnostic snapshot");
  });
});
