import { describe, expect, test } from "vitest";

import {
  classifyNanpureDependency,
  NANPURE_DIFFICULTY_MODEL_VERSION,
  rateUniqueNanpureDifficulty,
} from "./difficulty-rating";
import type { NanpureBoard, NanpureCell } from "./state";

function boardFromString(value: string): NanpureBoard {
  return [...value].map<NanpureCell>((cell) =>
    cell === "." || cell === "0" ? null : (Number(cell) as NanpureCell),
  );
}

const easyPuzzle = boardFromString(
  "......812.143..59...5216...4..567.8.8....346.1.7.4..2.7.....95.5.1.8.64.6....4.7.",
);

const normalPuzzle = boardFromString(
  ".1...6..9.....7...3..59.1.65312.897....1...32..473...1..5...39.9.....2..7....36.8",
);

const hardPuzzle = boardFromString(
  "56.....2.3.......91..23.5..6..4.83....5.......913..6.2...91.83..8.6...4.....4...5",
);

const unsupportedPuzzle = boardFromString(
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
);

describe("classifyNanpureDependency", () => {
  test.each([
    [14.6, "easy"],
    [14.59, "normal"],
    [9.37, "normal"],
    [9.36, "hard"],
  ] as const)(
    "平均の次の一手候補数 %s を %s と分類すること",
    (meanAvailablePlacementCount, difficulty) => {
      const result = classifyNanpureDependency({
        observedStepCount: 25,
        meanAvailablePlacementCount,
        minimumAvailablePlacementCount: 1,
        singleOptionStepCount: 1,
      });

      expect(result).toBe(difficulty);
    },
  );
});

describe("rateUniqueNanpureDifficulty", () => {
  test.each([
    ["easy", easyPuzzle],
    ["normal", normalPuzzle],
    ["hard", hardPuzzle],
  ] as const)("%s の代表問題を分類できること", (difficulty, puzzle) => {
    const result = rateUniqueNanpureDifficulty(puzzle);

    expect(result).toMatchObject({
      status: "rated",
      modelVersion: NANPURE_DIFFICULTY_MODEL_VERSION,
      difficulty,
    });
  });

  test("対応手筋で解き切れない問題を難しい問題と決めつけないこと", () => {
    const result = rateUniqueNanpureDifficulty(unsupportedPuzzle);

    expect(result.status).toBe("unsupported");
    expect(result).not.toHaveProperty("difficulty");
  });
});
