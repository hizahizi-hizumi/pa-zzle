import {
  _private,
  assertIceFloorMazeProblem,
  countIceFloorMazeRecordedDrawnCells,
  createIceFloorMazeProblemIdentity,
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
    [
      "開始位置が薄い氷",
      {
        ...problem,
        board: parseIceFloorMazeBoard([
          "#.......",
          ".c......",
          "........",
          "........",
          "........",
          "........",
          "........",
          "........",
        ]),
      },
    ],
    [
      "ゴールが盤面の外のマス",
      {
        ...problem,
        board: parseIceFloorMazeBoard([
          "#.......",
          "........",
          "........",
          "........",
          "........",
          "........",
          "........",
          ".......x",
        ]),
      },
    ],
    [
      "盤面の外だけの行が端に残る",
      {
        board: parseIceFloorMazeBoard([
          "#.......",
          "........",
          "........",
          "........",
          "........",
          "........",
          "........",
          "xxxxxxxx",
        ]),
        start: 9,
        goal: 55,
      },
    ],

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

// #  1  b
// 3  c  5
// 6  7  8
// x  10 x
// 開始位置 3 から下・右の2手でゴール 8 に止まる。
const elementProblem: IceFloorMazeProblem = {
  board: parseIceFloorMazeBoard(["#.b", ".c.", "...", "x.x"]),
  start: 3,
  goal: 8,
};

describe("createIceFloorMazeProblemIdentity", () => {
  test("2マスずつのマスの種類の base32 符号・開始位置・ゴールを seed にし、盤面の形を条件にすること", () => {
    const identity = createIceFloorMazeProblemIdentity(problem);

    expect(identity).toEqual({
      generatorVersion: "2",
      seed: "50000000000000000000000000000000-9-63",
      conditions: { width: 8, height: 8 },
    });
  });

  test("もろい岩・薄い氷・盤面の外を符号に入れること", () => {
    const identity = createIceFloorMazeProblemIdentity(elementProblem);

    expect(identity.seed).toBe("5af044-3-8");
  });
});

describe("restoreIceFloorMazeProblem", () => {
  describe("要素と盤面の外のある盤面の場合", () => {
    const identity = createIceFloorMazeProblemIdentity(elementProblem);

    test("identity から同じ問題を復号すること", () => {
      const restored = restoreIceFloorMazeProblem(identity);

      expect(restored).toEqual({ problem: elementProblem, identity });
    });
  });

  describe("マス数が奇数の盤面の場合", () => {
    // 符号の末尾の詰め物を、マス数が奇数の 9×9 で確かめる。
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
      seed: "5000000000000000000000000000000-9-63",
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
  const cells = "50000000000000000000000000000000";
  const invalidSeeds = [
    ["マスの符号の桁が足りない", `${cells.slice(1)}-9-63`],
    ["2マスの組に当たらない桁がある", `${cells.slice(1)}p-9-63`],
    ["大文字の桁がある", `${cells.slice(1)}A-9-63`],
    ["開始位置が岩", `${cells}-0-63`],
    ["ゴールが番号の範囲の外", `${cells}-9-64`],
    ["開始位置とゴールが同じ", `${cells}-9-9`],
    ["位置の数に先頭の0がある", `${cells}-09-63`],
    ["区切りが足りない", `${cells}-9`],
    ["初期版の符号", "8000000000000000-9-63"],
  ] as const;

  test.each(invalidSeeds)("%s seed を復号しないこと", (_, seed) => {
    const decoded = decodeIceFloorMazeProblem(seed, shape);

    expect(decoded).toBeNull();
  });

  describe("マス数の外にあたる詰め物が氷でない場合", () => {
    // 3×3 は9マスで、5桁目の後のマスは詰め物。`1` は（氷, 岩）。
    const nineCellShape = { width: 3, height: 3 };

    test("復号しないこと", () => {
      const decoded = decodeIceFloorMazeProblem("00001-0-8", nineCellShape);

      expect(decoded).toBeNull();
    });
  });
});

describe("isIceFloorMazeProblemIdentity", () => {
  const identity = createIceFloorMazeProblemIdentity(problem);
  const cases = [
    ["今の生成器の identity", identity, true],
    ["別の版の identity", { ...identity, generatorVersion: "0" }, false],
    [
      "初期版の identity",
      {
        generatorVersion: "1",
        seed: "8000000000000000-9-63",
        conditions: { width: 8, height: 8 },
      },
      false,
    ],
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
    [
      "初期版の記録の identity",
      {
        generatorVersion: "1",
        seed: "8000000000000000-9-63",
        conditions: { width: 8, height: 8 },
      },
      true,
    ],
    ["今の版で復号できない identity", { ...identity, seed: "broken" }, false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, value, expected) => {
    const result = isIceFloorMazeRecordedProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("countIceFloorMazeRecordedDrawnCells", () => {
  const cases = [
    [
      "今の版は盤面の外を除いて数える",
      createIceFloorMazeProblemIdentity(elementProblem),
      10,
    ],
    [
      "初期版は幅 × 高さを数える",
      {
        generatorVersion: "1",
        seed: "8000000000000000-9-63",
        conditions: { width: 8, height: 10 },
      },
      80,
    ],
  ] as const;

  test.each(cases)("%sこと", (_, identity, expected) => {
    const count = countIceFloorMazeRecordedDrawnCells(identity);

    expect(count).toBe(expected);
  });
});
