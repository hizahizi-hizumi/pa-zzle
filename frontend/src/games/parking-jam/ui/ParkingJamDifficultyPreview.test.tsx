import { cleanup, render } from "@testing-library/react";

import {
  assessParkingJamDifficulty,
  calculateParkingJamDifficultyFactors,
  type ParkingJamDifficulty,
  parkingJamDifficulties,
} from "@/games/parking-jam/difficulty";
import { analyzeParkingJamDifficulty } from "@/games/parking-jam/problem/difficulty-analysis";
import { analyzeParkingJamSolvability } from "@/games/parking-jam/problem/generation/solvability";
import { validateParkingJamBoard } from "@/games/parking-jam/puzzle/board";
import {
  _private,
  ParkingJamDifficultyPreview,
} from "@/games/parking-jam/ui/ParkingJamDifficultyPreview";

const { createPreviewBoard } = _private;

afterEach(cleanup);

const difficulties = parkingJamDifficulties.map(function toId({ id }) {
  return id;
});
const adjacentDifficulties = difficulties
  .slice(1)
  .map(function toAdjacentPair(higher, index) {
    return [difficulties[index] as ParkingJamDifficulty, higher] as const;
  });

function analyzePreviewBoard(difficulty: ParkingJamDifficulty) {
  const board = createPreviewBoard(difficulty);
  return analyzeParkingJamDifficulty(
    board,
    analyzeParkingJamSolvability(board),
  );
}

describe("createPreviewBoard", () => {
  test.each(difficulties)(
    "レベル %s の駐車場が盤面の検証を通り全車を出庫できること",
    (difficulty) => {
      const board = createPreviewBoard(difficulty);

      const validate = () => validateParkingJamBoard(board);
      const solvability = analyzeParkingJamSolvability(board);

      expect(validate).not.toThrow();
      expect(solvability.status).toBe("solvable");
    },
  );

  test.each(difficulties)(
    "レベル %s の駐車場が本番の難易度判定で同じレベルになること",
    (difficulty) => {
      const assessment = assessParkingJamDifficulty(
        analyzePreviewBoard(difficulty),
      );

      expect(assessment).toMatchObject({
        status: "classified",
        difficulty,
      });
    },
  );

  test.each(adjacentDifficulties)(
    "レベル %s とレベル %s で駐車場の大きさが同じこと",
    (lower, higher) => {
      const lowerBoard = createPreviewBoard(lower);
      const higherBoard = createPreviewBoard(higher);

      expect([higherBoard.width, higherBoard.height]).toEqual([
        lowerBoard.width,
        lowerBoard.height,
      ]);
    },
  );

  test.each(adjacentDifficulties)(
    "レベル %s の車と道路開口をすべて同じ位置のままレベル %s が含むこと",
    (lower, higher) => {
      const lowerBoard = createPreviewBoard(lower);
      const higherBoard = createPreviewBoard(higher);

      expect(higherBoard.vehicles).toEqual(
        expect.arrayContaining([...lowerBoard.vehicles]),
      );
      expect(higherBoard.roadOpenings).toEqual(
        expect.arrayContaining([...lowerBoard.roadOpenings]),
      );
    },
  );

  test.each(adjacentDifficulties)(
    "レベル %s よりレベル %s で判定要因が弱まらず片方だけ強まること",
    (lower, higher) => {
      const lowerFactors = calculateParkingJamDifficultyFactors(
        analyzePreviewBoard(lower).features,
      );
      const higherFactors = calculateParkingJamDifficultyFactors(
        analyzePreviewBoard(higher).features,
      );
      if (!lowerFactors || !higherFactors) {
        throw new Error("Expected preview difficulty factors");
      }

      const increases = [
        higherFactors.dependency - lowerFactors.dependency,
        higherFactors.choiceConstraint - lowerFactors.choiceConstraint,
      ];

      expect(increases.every((increase) => increase >= 0)).toBe(true);
      expect(increases.filter((increase) => increase > 0)).toHaveLength(1);
    },
  );
});

describe("ParkingJamDifficultyPreview", () => {
  test.each(difficulties)(
    "レベル %s の駐車場の全車を描画すること",
    (difficulty) => {
      const { container } = render(
        <ParkingJamDifficultyPreview difficulty={difficulty} />,
      );

      const carBodies = container.querySelectorAll(".parking-jam-car__body");

      expect(carBodies).toHaveLength(
        createPreviewBoard(difficulty).vehicles.length,
      );
    },
  );
});
