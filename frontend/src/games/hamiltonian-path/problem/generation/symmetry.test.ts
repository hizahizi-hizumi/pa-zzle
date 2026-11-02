import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import {
  getHamiltonianPathSymmetryKey,
  listHamiltonianPathBoardSymmetries,
  mirrorHamiltonianPathBoardLeftRight,
  rotateHamiltonianPathBoardClockwise,
} from "@/games/hamiltonian-path/problem/generation/symmetry";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

describe("rotateHamiltonianPathBoardClockwise", () => {
  const board = parseHamiltonianPathBoard(["S|.", "", "# ."]);

  test("壁マス・始点を回し、左右の間の仕切りを上下の間の仕切りにすること", () => {
    const rotated = rotateHamiltonianPathBoardClockwise(board);

    expect(rotated).toEqual(parseHamiltonianPathBoard(["# S", "  -", ". ."]));
  });
});

describe("mirrorHamiltonianPathBoardLeftRight", () => {
  const board = parseHamiltonianPathBoard(["S . .", "-", ". .|.", "", "# . ."]);

  test("壁マス・始点・仕切りを左右反転すること", () => {
    const mirrored = mirrorHamiltonianPathBoardLeftRight(board);

    expect(mirrored).toEqual(
      parseHamiltonianPathBoard([". . S", "    -", ".|. .", "", ". . #"]),
    );
  });
});

describe("listHamiltonianPathBoardSymmetries", () => {
  const board = parseHamiltonianPathBoard([
    "S . . .",
    "  -",
    ". .|. .",
    "",
    ". # . .",
    "",
    ". . . .",
  ]);

  test("8通りのどの盤面も解の数が元の盤面と同じであること", () => {
    const symmetries = listHamiltonianPathBoardSymmetries(board);

    const solutionCounts = symmetries.map(
      (symmetry) =>
        countHamiltonianPathSolutions(symmetry, { solutionLimit: 1_000 })
          .solutionCount,
    );
    expect(symmetries).toHaveLength(8);
    expect(new Set(solutionCounts)).toEqual(
      new Set([
        countHamiltonianPathSolutions(board, { solutionLimit: 1_000 })
          .solutionCount,
      ]),
    );
  });
});

describe("getHamiltonianPathSymmetryKey", () => {
  const board = parseHamiltonianPathBoard([
    "S . .",
    "  -",
    ". . .",
    "",
    ". . #",
  ]);
  const otherBoard = parseHamiltonianPathBoard([
    "S . .",
    "-",
    ". . .",
    "",
    ". . #",
  ]);

  test("回転・反転した盤面に同じキーを返すこと", () => {
    const keys = listHamiltonianPathBoardSymmetries(board).map(
      getHamiltonianPathSymmetryKey,
    );

    expect(new Set(keys).size).toBe(1);
  });

  test("仕切りの位置が違う盤面に別のキーを返すこと", () => {
    const key = getHamiltonianPathSymmetryKey(board);
    const otherKey = getHamiltonianPathSymmetryKey(otherBoard);

    expect(otherKey).not.toBe(key);
  });
});
