import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import {
  getHitofudePuzzleSymmetryKey,
  listHitofudePuzzleBoardSymmetries,
  mirrorHitofudePuzzleBoardLeftRight,
  rotateHitofudePuzzleBoardClockwise,
} from "@/games/hitofude-puzzle/problem/generation/symmetry";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

describe("rotateHitofudePuzzleBoardClockwise", () => {
  const board = parseHitofudePuzzleBoard(["S . .", ". . #", "# . ."]);

  test("穴・始点を時計回りに回すこと", () => {
    const rotated = rotateHitofudePuzzleBoardClockwise(board);

    expect(rotated).toEqual(
      parseHitofudePuzzleBoard(["# . S", ". . .", ". # ."]),
    );
  });
});

describe("mirrorHitofudePuzzleBoardLeftRight", () => {
  const board = parseHitofudePuzzleBoard(["S . .", ". . #", "# . ."]);

  test("穴・始点を左右反転すること", () => {
    const mirrored = mirrorHitofudePuzzleBoardLeftRight(board);

    expect(mirrored).toEqual(
      parseHitofudePuzzleBoard([". . S", "# . .", ". . #"]),
    );
  });
});

describe("listHitofudePuzzleBoardSymmetries", () => {
  const board = parseHitofudePuzzleBoard([
    "S . . .",
    ". . . #",
    ". # . .",
    ". . . .",
  ]);

  test("8通りのどの盤面も解の数が元の盤面と同じであること", () => {
    const symmetries = listHitofudePuzzleBoardSymmetries(board);

    const solutionCounts = symmetries.map(
      (symmetry) =>
        countHitofudePuzzleSolutions(symmetry, { solutionLimit: 1_000 })
          .solutionCount,
    );
    expect(symmetries).toHaveLength(8);
    expect(new Set(solutionCounts)).toEqual(
      new Set([
        countHitofudePuzzleSolutions(board, { solutionLimit: 1_000 })
          .solutionCount,
      ]),
    );
  });
});

describe("getHitofudePuzzleSymmetryKey", () => {
  const board = parseHitofudePuzzleBoard(["S . .", ". . .", ". . #"]);
  const otherBoard = parseHitofudePuzzleBoard(["S . .", ". . #", ". . ."]);

  test("回転・反転した盤面に同じキーを返すこと", () => {
    const keys = listHitofudePuzzleBoardSymmetries(board).map(
      getHitofudePuzzleSymmetryKey,
    );

    expect(new Set(keys).size).toBe(1);
  });

  test("穴の位置が違う盤面に別のキーを返すこと", () => {
    const key = getHitofudePuzzleSymmetryKey(board);
    const otherKey = getHitofudePuzzleSymmetryKey(otherBoard);

    expect(otherKey).not.toBe(key);
  });
});
