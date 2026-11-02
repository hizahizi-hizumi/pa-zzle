import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createHitofudePuzzleDiagnosticSnapshot,
} from "@/games/hitofude-puzzle/diagnostics";
import { getHitofudePuzzleSolveWorkload } from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { selectHitofudePuzzleProblemForDifficulty } from "@/games/hitofude-puzzle/problem-selection";

const {
  parseHitofudePuzzleDiagnosticSnapshot,
  restoreHitofudePuzzleProblemFromDiagnosticSnapshot,
} = _private;

describe("HitofudePuzzleDiagnosticSnapshot", () => {
  const selected = selectHitofudePuzzleProblemForDifficulty(
    "3",
    "diagnostic-seed",
  );
  const snapshot = createHitofudePuzzleDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    problem: selected.problem,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const solutionSearch = countHitofudePuzzleSolutions(selected.problem);
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
    const parsed = parseHitofudePuzzleDiagnosticSnapshot(serialized);
    const restored = restoreHitofudePuzzleProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("一意解を確かめ、解探索が見つけたただ1つの正解の道を持つこと", () => {
    const { uniqueness, solution } = snapshot;

    expect(uniqueness).toMatchObject({ status: "complete", solutionCount: 1 });
    expect(solutionSearch.solutionCount).toBe(1);
    expect(solution).toEqual(solutionSearch.firstSolutions[0]);
  });

  test("問題集の問題を分析し直して、問題集と同じ作業の量とレベルを得ること", () => {
    const { difficultyAnalysis, difficultyAssessment } = snapshot;
    const workload =
      difficultyAnalysis.status === "analyzed"
        ? getHitofudePuzzleSolveWorkload(difficultyAnalysis)
        : null;

    expect(difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
    });
    expect(workload).toEqual(selected.workload);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseHitofudePuzzleDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid hitofude-puzzle diagnostic snapshot");
  });
});
