import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import {
  areHitofudePuzzleOpenCellsConnected,
  findHitofudePuzzleStranding,
  isHitofudePuzzleDeadEnd,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";

// 0 1 2
// 3 # 5
// 6 7 #
const board = parseHitofudePuzzleBoard(["S . .", ". # .", ". . #"]);

describe("isHitofudePuzzleSolved", () => {
  const openBoard = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);
  const solution = [0, 1, 2, 5, 4, 3, 6, 7, 8];

  test("始点から全有効マスを1回ずつ、隣り合うマスへ進んだ道を解とすること", () => {
    const solved = isHitofudePuzzleSolved(openBoard, solution);

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
    const solved = isHitofudePuzzleSolved(openBoard, path);

    expect(solved).toBe(false);
  });

  describe("穴のある盤面の場合", () => {
    const blockedPath = [0, 1, 2, 5, 4, 3, 6];

    test("穴を通る道を解としないこと", () => {
      const solved = isHitofudePuzzleSolved(board, blockedPath);

      expect(solved).toBe(false);
    });
  });
});

describe("isHitofudePuzzleDeadEnd", () => {
  const cases: readonly [string, readonly number[], boolean][] = [
    ["先端の隣が通過済みのマスか穴だけの", [0, 1, 2, 5], true],
    ["先端から未通過のマスへ延ばせる", [0, 3], false],
  ];

  test.each(cases)(
    "%s道の行き止まりの判定が %s であること",
    (_, path, expected) => {
      const deadEnd = isHitofudePuzzleDeadEnd(board, path);

      expect(deadEnd).toBe(expected);
    },
  );

  describe("全マスを通った場合", () => {
    const openBoard = parseHitofudePuzzleBoard(["S .", ". ."]);
    const solution = [0, 1, 3, 2];

    test("行き止まりとしないこと", () => {
      const deadEnd = isHitofudePuzzleDeadEnd(openBoard, solution);

      expect(deadEnd).toBe(false);
    });
  });
});

describe("findHitofudePuzzleStranding", () => {
  // 0 1 2 3
  // 4 5 6 7
  // 8 9 a b
  // c d e f
  const openBoard = parseHitofudePuzzleBoard([
    "S . . .",
    ". . . .",
    ". . . .",
    ". . . .",
  ]);

  const topRowPath = [0, 1, 2, 3];
  const cornerIsolatingPath = [0, 4, 5, 1, 2, 6, 7, 11, 10, 9, 8, 12, 13, 14];
  const twoDeadEndsPath = [0, 1, 2, 6, 5, 4, 8, 9, 13];
  const dividingPath = [0, 1, 5, 9, 13, 14];

  test("取り残しが無い道には null を返すこと", () => {
    const stranding = findHitofudePuzzleStranding(openBoard, topRowPath);

    expect(stranding).toBeNull();
  });

  test("先端からも他の未通過マスからも入れないマスを孤立マスとして返すこと", () => {
    const stranding = findHitofudePuzzleStranding(
      openBoard,
      cornerIsolatingPath,
    );

    expect(stranding?.isolatedCells).toEqual([3]);
  });

  test("終点にしかなれないマスが2つ以上あれば行き止まりのマスとして返すこと", () => {
    const stranding = findHitofudePuzzleStranding(openBoard, twoDeadEndsPath);

    expect(stranding?.deadEndCells).toEqual([3, 12]);
  });

  test("道で切り離された未通過のマスを返すこと", () => {
    const stranding = findHitofudePuzzleStranding(openBoard, dividingPath);

    expect(stranding?.separatedCells).toEqual([4, 8, 12]);
  });
});

describe("areHitofudePuzzleOpenCellsConnected", () => {
  const connected = parseHitofudePuzzleBoard(["S #", ". ."]);
  const separated = parseHitofudePuzzleBoard(["S #", "# ."]);

  test("穴を回り込んでつながる盤面をつながっているとすること", () => {
    const result = areHitofudePuzzleOpenCellsConnected(connected);

    expect(result).toBe(true);
  });

  test("穴で切り離された盤面をつながっていないとすること", () => {
    const result = areHitofudePuzzleOpenCellsConnected(separated);

    expect(result).toBe(false);
  });
});
