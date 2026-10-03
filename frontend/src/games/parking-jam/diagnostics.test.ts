import {
  createParkingJamDiagnosticSnapshot,
  serializeParkingJamDiagnosticSnapshot,
} from "@/games/parking-jam/diagnostics";
import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";

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

    const serialized = serializeParkingJamDiagnosticSnapshot(snapshot);

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
