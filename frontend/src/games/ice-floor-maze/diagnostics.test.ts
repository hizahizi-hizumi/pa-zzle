import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createIceFloorMazeDiagnosticSnapshot,
} from "@/games/ice-floor-maze/diagnostics";
import { analyzeIceFloorMazeDifficulty } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";

const {
  parseIceFloorMazeDiagnosticSnapshot,
  restoreIceFloorMazeProblemFromDiagnosticSnapshot,
} = _private;

const selected = selectIceFloorMazeProblemForDifficulty(
  "3",
  "ice-floor-maze-diagnostics",
);

describe("createIceFloorMazeDiagnosticSnapshot", () => {
  const snapshot = createIceFloorMazeDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });
  const expectedAnalysis = analyzeIceFloorMazeDifficulty(selected.problem);

  test("問題の identity と、identity から分析し直した難易度の特徴と分類を保持すること", () => {
    const serialized = serializeInternalDiagnosticSnapshot(snapshot);

    expect(snapshot.problemIdentity).toEqual(selected.identity);
    expect(snapshot.difficultyAnalysis).toEqual(expectedAnalysis);
    expect(snapshot.difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
      planningDepth: 3,
    });
    expect(serialized).toContain('"trialMoveCount"');
  });
});

describe("parseIceFloorMazeDiagnosticSnapshot", () => {
  const snapshot = createIceFloorMazeDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "reflection" }],
    ["そのレベルで出さない盤面の形", { ...snapshot, difficulty: "1" }],
    ["分類が無い", { ...snapshot, difficultyAssessment: null }],
    ["特徴が無い", { ...snapshot, difficultyAnalysis: undefined }],
    [
      "別の生成器の identity",
      {
        ...snapshot,
        problemIdentity: { ...snapshot.problemIdentity, generatorVersion: "0" },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseIceFloorMazeDiagnosticSnapshot(serialized);
    const restored = restoreIceFloorMazeProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(selected.problem);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseIceFloorMazeDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid ice-floor-maze diagnostic snapshot");
  });
});
