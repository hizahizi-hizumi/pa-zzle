import {
  createParkingJamDiagnosticSnapshot,
  serializeParkingJamDiagnosticSnapshot,
} from "./diagnostics";
import { generateParkingJamProblemForDifficulty } from "./problem-selection";

describe("parking jam diagnostics", () => {
  test("問題identityと難易度特徴を同じsnapshotへ保持すること", () => {
    const generated = generateParkingJamProblemForDifficulty(
      "normal",
      "parking-jam-diagnostics",
    );
    const snapshot = createParkingJamDiagnosticSnapshot({
      difficulty: "normal",
      problemIdentity: generated.identity,
      difficultyAnalysis: generated.difficultyAnalysis,
      buildRevision: "test-revision",
    });

    expect(snapshot.problemIdentity).toEqual(generated.identity);
    expect(snapshot.difficultyAnalysis).toEqual(generated.difficultyAnalysis);
    expect(serializeParkingJamDiagnosticSnapshot(snapshot)).toContain(
      '"difficultyAnalysis"',
    );
  });
});
