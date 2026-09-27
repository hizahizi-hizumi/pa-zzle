import { cleanup, render } from "@testing-library/react";

import {
  assessParkingJamDifficulty,
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
const adjacentDifficulties = [
  ["easy", "normal"],
  ["normal", "hard"],
] as const;

function assessPreviewBoard(difficulty: (typeof difficulties)[number]) {
  const board = createPreviewBoard(difficulty);
  const solvability = analyzeParkingJamSolvability(board);
  return assessParkingJamDifficulty(
    analyzeParkingJamDifficulty(board, solvability),
  );
}

describe("createPreviewBoard", () => {
  test.each(difficulties)(
    "%s の駐車場が盤面の検証を通り全車を出庫できること",
    (difficulty) => {
      const board = createPreviewBoard(difficulty);

      expect(() => validateParkingJamBoard(board)).not.toThrow();
      expect(analyzeParkingJamSolvability(board).status).toBe("solvable");
    },
  );

  test.each(difficulties)(
    "%s の駐車場が宣言した難易度に判定されること",
    (difficulty) => {
      expect(assessPreviewBoard(difficulty).difficulty).toBe(difficulty);
    },
  );

  test.each(adjacentDifficulties)(
    "%s と %s で駐車場の大きさと道路開口が同じこと",
    (lower, higher) => {
      const lowerBoard = createPreviewBoard(lower);
      const higherBoard = createPreviewBoard(higher);

      expect([higherBoard.width, higherBoard.height]).toEqual([
        lowerBoard.width,
        lowerBoard.height,
      ]);
      expect(higherBoard.roadOpenings).toEqual(lowerBoard.roadOpenings);
    },
  );

  test.each(adjacentDifficulties)(
    "%s の車をすべて同じ位置のまま %s が含むこと",
    (lower, higher) => {
      const lowerVehicles = createPreviewBoard(lower).vehicles;
      const higherVehicles = createPreviewBoard(higher).vehicles;

      expect(higherVehicles).toEqual(
        expect.arrayContaining([...lowerVehicles]),
      );
      expect(higherVehicles.length).toBeGreaterThan(lowerVehicles.length);
    },
  );

  test.each(adjacentDifficulties)(
    "%s より %s で難易度要因がどれも減らず少なくとも1つ増えること",
    (lower, higher) => {
      const lowerFactors = Object.values(assessPreviewBoard(lower).factors);
      const higherFactors = Object.values(assessPreviewBoard(higher).factors);

      lowerFactors.forEach(function expectNotDecreased(lowerValue, index) {
        expect(higherFactors[index]).toBeGreaterThanOrEqual(lowerValue);
      });
      expect(
        higherFactors.some(function isIncreased(higherValue, index) {
          return higherValue > (lowerFactors[index] ?? higherValue);
        }),
      ).toBe(true);
    },
  );

  test("easy では全車がそのまま出られ、hard には2台以上に塞がれた車があること", () => {
    const easy = assessPreviewBoard("easy").factors;
    const hard = assessPreviewBoard("hard").factors;

    expect(easy.initialBlockedVehicleCount).toBe(0);
    expect(hard.initialAverageMinimumBlockingVehicleCount).toBeGreaterThan(1);
  });
});

describe("ParkingJamDifficultyPreview", () => {
  test.each(difficulties)("%s の駐車場の全車を描画すること", (difficulty) => {
    const { container } = render(
      <ParkingJamDifficultyPreview difficulty={difficulty} />,
    );

    expect(container.querySelectorAll(".parking-jam-car__body")).toHaveLength(
      createPreviewBoard(difficulty).vehicles.length,
    );
  });
});
