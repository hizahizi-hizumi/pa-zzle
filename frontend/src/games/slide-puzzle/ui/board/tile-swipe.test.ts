import {
  getSlidePuzzleSwipeDirection,
  isSlidePuzzleSwipeTowardBlank,
  SLIDE_PUZZLE_SWIPE_THRESHOLD_PX,
} from "@/games/slide-puzzle/ui/board/tile-swipe";

describe("getSlidePuzzleSwipeDirection", () => {
  const cases = [
    ["左へ大きく動かすと左", -40, 6, "left"],
    ["右へ大きく動かすと右", 40, -6, "right"],
    ["上へ大きく動かすと上", 5, -40, "up"],
    ["下へ大きく動かすと下", -5, 40, "down"],
    [
      "しきい値より短い動きはタップ",
      SLIDE_PUZZLE_SWIPE_THRESHOLD_PX - 1,
      0,
      null,
    ],
  ] as const;

  test.each(cases)("%sとすること", (_, deltaX, deltaY, expected) => {
    const direction = getSlidePuzzleSwipeDirection(deltaX, deltaY);

    expect(direction).toBe(expected);
  });
});

describe("isSlidePuzzleSwipeTowardBlank", () => {
  // 1 2 3
  // 4 _ 5
  // 6 7 8
  const board = [1, 2, 3, 4, 0, 5, 6, 7, 8];
  // 1 _ 3
  // 4 2 5
  // 6 7 8
  const blankAtTop = [1, 0, 3, 4, 2, 5, 6, 7, 8];
  const cases = [
    ["空白の左のタイルを右へ", 3, "right", true],
    ["空白の左のタイルを左へ", 3, "left", false],
    ["空白の上のタイルを下へ", 1, "down", true],
    ["空白の下のタイルを上へ", 7, "up", true],
    ["空白と同じ行・列にないタイルを右へ", 0, "right", false],
  ] as const;

  test.each(cases)(
    "%sスワイプしたときの判定を返すこと",
    (_, cellIndex, direction, expected) => {
      const toward = isSlidePuzzleSwipeTowardBlank(board, cellIndex, direction);

      expect(toward).toBe(expected);
    },
  );

  test("同じ列で離れたタイルも、空白へ向かう向きならまとめて滑る操作として受けること", () => {
    const toward = isSlidePuzzleSwipeTowardBlank(blankAtTop, 7, "up");

    expect(toward).toBe(true);
  });
});
