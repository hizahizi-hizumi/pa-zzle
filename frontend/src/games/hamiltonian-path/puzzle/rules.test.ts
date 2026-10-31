import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import {
  areHamiltonianPathOpenCellsConnected,
  findHamiltonianPathStranding,
  isHamiltonianPathDeadEnd,
  isHamiltonianPathSolved,
} from "@/games/hamiltonian-path/puzzle/rules";

// 0 1|2
// 3 # 5
// 6 7 8   (5 と 8 の間に仕切り)
const board = parseHamiltonianPathBoard([
  "S .|.",
  "     ",
  ". # .",
  "    -",
  ". . .",
]);

describe("isHamiltonianPathSolved", () => {
  const openBoard = parseHamiltonianPathBoard([
    "S . .",
    "",
    ". . .",
    "",
    ". . .",
  ]);
  const solution = [0, 1, 2, 5, 4, 3, 6, 7, 8];

  test("始点から全有効マスを1回ずつ、隣り合うマスへ進んだ道を解とすること", () => {
    const solved = isHamiltonianPathSolved(openBoard, solution);

    expect(solved).toBe(true);
  });

  const invalidPaths: readonly [string, readonly number[]][] = [
    ["始点から始まらない", [1, 0, 3, 4, 2, 5, 8, 7, 6]],
    ["全マスを通っていない", [0, 1, 2, 5, 4, 3, 6, 7]],
    ["同じマスを2回通る", [0, 1, 2, 5, 4, 3, 6, 7, 6]],
    ["隣り合わないマスへ飛ぶ", [0, 1, 2, 5, 4, 3, 6, 8, 7]],
    ["盤面の外を通る", [0, 1, 2, 5, 4, 3, 6, 7, 9]],
  ];

  test.each(invalidPaths)("%s道を解としないこと", (_, path) => {
    const solved = isHamiltonianPathSolved(openBoard, path);

    expect(solved).toBe(false);
  });

  describe("壁と仕切りのある盤面の場合", () => {
    const blockedPath = [0, 3, 6, 7, 8, 5, 2, 1];

    test("仕切りを越える道を解としないこと", () => {
      const solved = isHamiltonianPathSolved(board, blockedPath);

      expect(solved).toBe(false);
    });
  });
});

describe("isHamiltonianPathDeadEnd", () => {
  const cases: readonly [string, readonly number[], boolean][] = [
    ["先端から未通過のマスへ延ばせない", [0, 1], true],
    ["先端から未通過のマスへ延ばせる", [0, 3], false],
    ["仕切りの向こうにしか未通過のマスが無い", [0, 3, 6, 7, 8], true],
  ];

  test.each(cases)(
    "%s道の行き止まりの判定が %s であること",
    (_, path, expected) => {
      const deadEnd = isHamiltonianPathDeadEnd(board, path);

      expect(deadEnd).toBe(expected);
    },
  );

  describe("全マスを通った場合", () => {
    const openBoard = parseHamiltonianPathBoard(["S .", "", ". ."]);
    const solution = [0, 1, 3, 2];

    test("行き止まりとしないこと", () => {
      const deadEnd = isHamiltonianPathDeadEnd(openBoard, solution);

      expect(deadEnd).toBe(false);
    });
  });
});

describe("findHamiltonianPathStranding", () => {
  // 0 1 2 3
  // 4 5 6 7
  // 8 9 a b
  // c d e f
  const openBoard = parseHamiltonianPathBoard([
    "S . . .",
    "",
    ". . . .",
    "",
    ". . . .",
    "",
    ". . . .",
  ]);

  const topRowPath = [0, 1, 2, 3];
  const cornerIsolatingPath = [0, 4, 5, 1, 2, 6, 7, 11, 10, 9, 8, 12, 13, 14];
  const twoDeadEndsPath = [0, 1, 2, 6, 5, 4, 8, 9, 13];
  const dividingPath = [0, 1, 5, 9, 13, 14];

  test("取り残しが無い道には null を返すこと", () => {
    const stranding = findHamiltonianPathStranding(openBoard, topRowPath);

    expect(stranding).toBeNull();
  });

  test("先端からも他の未通過マスからも入れないマスを孤立マスとして返すこと", () => {
    const stranding = findHamiltonianPathStranding(
      openBoard,
      cornerIsolatingPath,
    );

    expect(stranding?.isolatedCells).toEqual([3]);
  });

  test("終点にしかなれないマスが2つ以上あれば行き止まりのマスとして返すこと", () => {
    const stranding = findHamiltonianPathStranding(openBoard, twoDeadEndsPath);

    expect(stranding?.deadEndCells).toEqual([3, 12]);
  });

  test("道で切り離された未通過のマスを返すこと", () => {
    const stranding = findHamiltonianPathStranding(openBoard, dividingPath);

    expect(stranding?.separatedCells).toEqual([4, 8, 12]);
  });
});

describe("areHamiltonianPathOpenCellsConnected", () => {
  const connected = parseHamiltonianPathBoard(["S .", "-", ". ."]);
  const separated = parseHamiltonianPathBoard(["S|.", "-", ". ."]);

  test("仕切りを回り込んでつながる盤面をつながっているとすること", () => {
    const result = areHamiltonianPathOpenCellsConnected(connected);

    expect(result).toBe(true);
  });

  test("仕切りで切り離された盤面をつながっていないとすること", () => {
    const result = areHamiltonianPathOpenCellsConnected(separated);

    expect(result).toBe(false);
  });
});
