import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createParkingJamDiagnosticSnapshot,
} from "@/games/parking-jam/diagnostics";
import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";

const {
  parseParkingJamDiagnosticSnapshot,
  restoreParkingJamProblemFromDiagnosticSnapshot,
} = _private;

const selected = selectParkingJamProblemForDifficulty(
  "3",
  "parking-jam-diagnostics",
);

describe("createParkingJamDiagnosticSnapshot", () => {
  const snapshot = createParkingJamDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });

  test("問題identityから解析し直した難易度特徴と判定を保持すること", () => {
    const { difficultyAnalysis } = restoreParkingJamProblem(selected.identity);

    const serialized = serializeInternalDiagnosticSnapshot(snapshot);

    expect(snapshot.problemIdentity).toEqual(selected.identity);
    expect(snapshot.difficultyAnalysis).toEqual(difficultyAnalysis);
    expect(snapshot.difficultyModelVersion).toBe(
      PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    );
    expect(snapshot.difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
    });
    expect(serialized).toContain('"difficultyAssessment"');
  });
});

describe("parseParkingJamDiagnosticSnapshot", () => {
  const snapshot = createParkingJamDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "water-sort" }],
    ["判定モデルの版が違う", { ...snapshot, difficultyModelVersion: "old" }],
    ["判定が無い", { ...snapshot, difficultyAssessment: null }],
    [
      "別の生成器の identity",
      {
        ...snapshot,
        problemIdentity: { ...snapshot.problemIdentity, generatorVersion: "1" },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseParkingJamDiagnosticSnapshot(serialized);
    const restored = restoreParkingJamProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(selected.problem);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseParkingJamDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid parking-jam diagnostic snapshot");
  });
});
