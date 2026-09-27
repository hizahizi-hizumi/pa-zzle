import {
  assessParkingJamDifficulty,
  parkingJamDifficulties,
} from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import { parkingJamDifficultyPreviewProblems } from "@/games/parking-jam/ui/difficulty-preview-problems";

describe("parkingJamDifficultyPreviewProblems", () => {
  const cases = parkingJamDifficulties.map(
    ({ id }) => [id, parkingJamDifficultyPreviewProblems[id]] as const,
  );

  test.each(cases)(
    "代表盤面が識別情報から復元した問題と一致すること: %s",
    (_difficulty, previewProblem) => {
      const restored = restoreParkingJamProblem(previewProblem.identity);

      expect(restored.problem.board).toEqual(previewProblem.board);
    },
  );

  test.each(cases)(
    "代表問題が宣言した難易度に判定されること: %s",
    (difficulty, previewProblem) => {
      const restored = restoreParkingJamProblem(previewProblem.identity);
      const assessment = assessParkingJamDifficulty(
        restored.difficultyAnalysis,
      );

      expect(assessment.difficulty).toBe(difficulty);
    },
  );
});
