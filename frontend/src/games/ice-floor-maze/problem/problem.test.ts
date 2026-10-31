import {
  _private,
  assertIceFloorMazeProblem,
  createIceFloorMazeProblemIdentity,
  ICE_FLOOR_MAZE_GENERATOR_VERSION,
  type IceFloorMazeProblem,
  isIceFloorMazeBoardShape,
  isIceFloorMazeProblemIdentity,
  isIceFloorMazeRecordedProblemIdentity,
  restoreIceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";

const { decodeIceFloorMazeProblem } = _private;

// #  1  2  3  4  5  6  7
// 8  9  ...            15
// ...
// 48 ...         54    55
// 56 ...               63
const problem: IceFloorMazeProblem = {
  board: parseIceFloorMazeBoard([
    "#.......",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ]),
  start: 9,
  goal: 63,
};

describe("isIceFloorMazeBoardShape", () => {
  const cases = [
    ["8×8 の正方形", { width: 8, height: 8 }, true],
    ["9×12 の縦長", { width: 9, height: 12 }, true],
    ["最も広い 12×14", { width: 12, height: 14 }, true],
    ["横長", { width: 10, height: 8 }, false],
    ["幅が広すぎる", { width: 13, height: 14 }, false],
    ["高さが高すぎる", { width: 12, height: 15 }, false],
    ["一辺が短すぎる", { width: 2, height: 4 }, false],
    ["整数でない", { width: 8.5, height: 9 }, false],
    ["形でない値", "8x8", false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, shape, expected) => {
    const result = isIceFloorMazeBoardShape(shape);

    expect(result).toBe(expected);
  });
});

describe("assertIceFloorMazeProblem", () => {
  test("開始位置からゴールで止まれる問題を受け入れること", () => {
    function act() {
      assertIceFloorMazeProblem(problem);
    }

    expect(act).not.toThrow();
  });

  const invalidCases = [
    ["開始位置が岩", { ...problem, start: 0 }],
    ["ゴールが盤面の外", { ...problem, goal: 64 }],
    ["開始位置とゴールが同じ", { ...problem, goal: 9 }],
    ["ゴールで止まれない", { ...problem, goal: 10 }],
    [
      "横長の盤面",
      {
        board: parseIceFloorMazeBoard(["....", "...."]),
        start: 0,
        goal: 3,
      },
    ],
  ] as const;

  test.each(invalidCases)("%sの問題を拒否すること", (_, invalidProblem) => {
    function act() {
      assertIceFloorMazeProblem(invalidProblem);
    }

    expect(act).toThrow();
  });
});

describe("createIceFloorMazeProblemIdentity", () => {
  test("岩の配置の16進符号・開始位置・ゴールを seed にし、盤面の形を条件にすること", () => {
    const identity = createIceFloorMazeProblemIdentity(problem);

    expect(identity).toEqual({
      generatorVersion: ICE_FLOOR_MAZE_GENERATOR_VERSION,
      seed: "8000000000000000-9-63",
      conditions: { width: 8, height: 8 },
    });
  });
});

describe("restoreIceFloorMazeProblem", () => {
  describe("マス数が4の倍数でない盤面の場合", () => {
    // 9×12 は108マスで割り切れるので、余りの出る 9×9 で符号の末尾の詰め物を確かめる。
    const oddProblem: IceFloorMazeProblem = {
      board: parseIceFloorMazeBoard([
        "........#",
        ".........",
        ".........",
        ".........",
        ".........",
        ".........",
        ".........",
        ".........",
        "#.......#",
      ]),
      start: 1,
      goal: 79,
    };
    const identity = createIceFloorMazeProblemIdentity(oddProblem);

    test("identity から同じ問題を復号すること", () => {
      const restored = restoreIceFloorMazeProblem(identity);

      expect(restored).toEqual({ problem: oddProblem, identity });
    });
  });

  describe("壊れた seed の場合", () => {
    const identity = {
      ...createIceFloorMazeProblemIdentity(problem),
      seed: "800000000000000-9-63",
    };

    test("問題を復号せずに拒否すること", () => {
      function act() {
        restoreIceFloorMazeProblem(identity);
      }

      expect(act).toThrow();
    });
  });
});

describe("decodeIceFloorMazeProblem", () => {
  const shape = { width: 8, height: 8 };
  const invalidSeeds = [
    ["岩の符号の桁が足りない", "800000000000000-9-63"],
    ["16進でない文字がある", "800000000000000g-9-63"],
    ["開始位置が岩", "8000000000000000-0-63"],
    ["ゴールが盤面の外", "8000000000000000-9-64"],
    ["開始位置とゴールが同じ", "8000000000000000-9-9"],
    ["位置の数に先頭の0がある", "8000000000000000-09-63"],
    ["区切りが足りない", "8000000000000000-9"],
  ] as const;

  test.each(invalidSeeds)("%s seed を復号しないこと", (_, seed) => {
    const decoded = decodeIceFloorMazeProblem(seed, shape);

    expect(decoded).toBeNull();
  });

  describe("盤面の外にあたる詰め物のビットが立っている場合", () => {
    // 3×3 は9マスで、3桁目の下位3ビットは盤面の外。
    const nineCellShape = { width: 3, height: 3 };

    test("復号しないこと", () => {
      const decoded = decodeIceFloorMazeProblem("001-0-8", nineCellShape);

      expect(decoded).toBeNull();
    });
  });
});

describe("isIceFloorMazeProblemIdentity", () => {
  const identity = createIceFloorMazeProblemIdentity(problem);
  const cases = [
    ["今の生成器の identity", identity, true],
    ["別の版の identity", { ...identity, generatorVersion: "0" }, false],
    ["横長の条件", { ...identity, conditions: { width: 8, height: 7 } }, false],
    [
      "盤面の形と合わない seed",
      { ...identity, conditions: { width: 8, height: 9 } },
      false,
    ],
    ["seed が文字列でない", { ...identity, seed: 1 }, false],
    ["オブジェクトでない値", "8000000000000000-9-63", false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, value, expected) => {
    const result = isIceFloorMazeProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("isIceFloorMazeRecordedProblemIdentity", () => {
  const identity = createIceFloorMazeProblemIdentity(problem);
  const cases = [
    ["今の生成器の identity", identity, true],
    [
      "盤面の形が読める別の版の identity",
      {
        generatorVersion: "0",
        seed: "old",
        conditions: { width: 10, height: 13 },
      },
      true,
    ],
    [
      "盤面の形が読めない別の版の identity",
      { generatorVersion: "0", seed: "old", conditions: { size: 10 } },
      false,
    ],
    ["今の版で復号できない identity", { ...identity, seed: "broken" }, false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, value, expected) => {
    const result = isIceFloorMazeRecordedProblemIdentity(value);

    expect(result).toBe(expected);
  });
});
