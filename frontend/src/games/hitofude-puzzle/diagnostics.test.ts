import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createHitofudePuzzleDiagnosticSnapshot,
} from "@/games/hitofude-puzzle/diagnostics";
import { getHitofudePuzzleSolveWorkload } from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import { selectHitofudePuzzleProblemForDifficulty } from "@/games/hitofude-puzzle/problem-selection";

const {
  parseHitofudePuzzleDiagnosticSnapshot,
  restoreHitofudePuzzleProblemFromDiagnosticSnapshot,
} = _private;

/** レベル3 の問題は難しさへ歩く条件で作るので、生成し直しに数秒〜数十秒かかる。 */
const GENERATION_TIMEOUT_MS = 60_000;

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

  test(
    "一意解を確かめ、生成器と同じ正解の道を持つこと",
    () => {
      const { solution } = generateHitofudePuzzleProblem(selected.identity);

      expect(snapshot.uniqueness).toMatchObject({
        status: "complete",
        solutionCount: 1,
      });
      expect(snapshot.solution).toEqual(solution);
    },
    GENERATION_TIMEOUT_MS,
  );

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
