import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  listMagicSquareLines,
  type MagicSquareBoard,
  type MagicSquareCell,
  parseMagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  canPlaceMagicSquareValue,
  changesMagicSquareLineVerdict,
  enterMagicSquareValue,
  evaluateMagicSquareLine,
  findMagicSquareMemoRejection,
  findMagicSquareValueCell,
  isMagicSquareLineViolation,
  isMagicSquareSolved,
  listMagicSquareLineEvaluations,
  listMagicSquareMemoValueStates,
  listMagicSquareUsedValues,
  listMagicSquareValueStates,
  MAGIC_SQUARE_MEMO_CAPACITY,
  type MagicSquareLineStatus,
  type MagicSquareMemoRejection,
  placeMagicSquareValue,
  removeMagicSquareValue,
  toggleMagicSquareMemo,
} from "@/games/magic-square/puzzle/rules";
import {
  createMagicSquareInitialState,
  type MagicSquareState,
} from "@/games/magic-square/puzzle/state";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";

/** 解法器で一意解と確かめた問題の答え。4×4 が2つ、5×5 が4つ、6×6 が3つ。 */
const solutionRows = [
  ["14 4 5 11", "9 2 7 16", "8 13 12 1", "3 15 10 6"],
  ["4 6 11 13", "10 16 7 1", "15 9 2 8", "5 3 14 12"],
  [
    "11 3 6 21 24",
    "23 4 14 5 19",
    "8 18 20 12 7",
    "22 15 9 17 2",
    "1 25 16 10 13",
  ],
  [
    "18 11 1 22 13",
    "24 10 8 2 21",
    "4 7 25 23 6",
    "14 20 12 3 16",
    "5 17 19 15 9",
  ],
  [
    "8 12 5 21 19",
    "13 9 22 1 20",
    "18 16 10 14 7",
    "2 11 25 23 4",
    "24 17 3 6 15",
  ],
  [
    "21 2 18 19 5",
    "11 6 14 10 24",
    "4 12 15 25 9",
    "16 22 17 3 7",
    "13 23 1 8 20",
  ],
  [
    "11 16 15 12 27 30",
    "13 4 33 3 34 24",
    "32 9 20 14 8 28",
    "31 35 1 29 10 5",
    "18 26 23 17 25 2",
    "6 21 19 36 7 22",
  ],
  [
    "17 30 4 29 11 20",
    "10 23 32 14 26 6",
    "34 8 28 22 3 16",
    "25 2 7 13 31 33",
    "1 12 35 15 21 27",
    "24 36 5 18 19 9",
  ],
  [
    "4 26 35 31 10 5",
    "30 8 11 17 33 12",
    "2 36 29 19 1 24",
    "21 28 13 16 18 15",
    "20 7 14 25 22 23",
    "34 6 9 3 27 32",
  ],
] as const;

function rotate({ size, cells }: MagicSquareBoard): MagicSquareBoard {
  return {
    size,
    cells: cells.map((_, cellIndex) => {
      const row = Math.floor(cellIndex / size);
      const column = cellIndex % size;
      return cells[(size - 1 - column) * size + row] ?? null;
    }),
  };
}

function mirror({ size, cells }: MagicSquareBoard): MagicSquareBoard {
  return {
    size,
    cells: cells.map((_, cellIndex) => {
      const row = Math.floor(cellIndex / size);
      const column = cellIndex % size;
      return cells[row * size + (size - 1 - column)] ?? null;
    }),
  };
}

/** n²+1 から引いた数に替えても、どの列の合計も n(n²+1) − 合計 になり、魔方陣のままになる。 */
function complement({ size, cells }: MagicSquareBoard): MagicSquareBoard {
  const complementBase = getMagicSquareMaxValue(size) + 1;
  return {
    size,
    cells: cells.map((cell) => (cell === null ? null : complementBase - cell)),
  };
}

/** 回転と裏返しの8通りと、それぞれの補数の、16通りの魔方陣。 */
function listSymmetricSolutions(
  solution: MagicSquareBoard,
): MagicSquareBoard[] {
  const rotations = [solution];
  for (let turn = 1; turn < 4; turn += 1) {
    rotations.push(rotate(rotations[turn - 1]!));
  }
  const symmetric = [...rotations, ...rotations.map(mirror)];
  return [...symmetric, ...symmetric.map(complement)];
}

const solutions = solutionRows.flatMap((rows) =>
  listSymmetricSolutions(parseMagicSquareBoard(rows)),
);

type NaiveJudgement = {
  sums: number[];
  statuses: MagicSquareLineStatus[];
  solved: boolean;
};

/** 盤面を2次元の表にして、行・縦の列・斜めを添字で直接たどる判定。 */
function judgeNaively({ size, cells }: MagicSquareBoard): NaiveJudgement {
  const magicSum = (size * (size * size + 1)) / 2;
  const grid: MagicSquareCell[][] = [];
  for (let row = 0; row < size; row += 1) {
    grid.push(cells.slice(row * size, (row + 1) * size));
  }
  const lines: MagicSquareCell[][] = [
    ...grid,
    ...grid.map((_, column) => grid.map((row) => row[column] ?? null)),
    grid.map((row, index) => row[index] ?? null),
    grid.map((row, index) => row[size - 1 - index] ?? null),
  ];
  const sums: number[] = [];
  const statuses: MagicSquareLineStatus[] = [];
  for (const line of lines) {
    let sum = 0;
    let emptyCount = 0;
    for (const cell of line) {
      if (cell === null) {
        emptyCount += 1;
      } else {
        sum += cell;
      }
    }
    sums.push(sum);
    if (emptyCount === 0) {
      statuses.push(sum === magicSum ? "matched" : "unmatched");
    } else {
      statuses.push(sum >= magicSum ? "overreached" : "incomplete");
    }
  }
  const values = cells.filter((cell) => cell !== null);
  const usesEveryValueOnce =
    values.length === size * size &&
    new Set(values).size === values.length &&
    values.every((value) => value >= 1 && value <= size * size);
  return {
    sums,
    statuses,
    solved:
      usesEveryValueOnce && statuses.every((status) => status === "matched"),
  };
}

/**
 * 答えの一部を残した盤面に、残っていない数をいくつか入れる。答えどおりの途中、合計に届いた列、
 * 答えと違う数でそろった列、埋まって合わない列が混ざるよう、残す割合と入れる数を毎回変える。
 */
function createRandomPartialBoard(random: ProblemRandom): MagicSquareBoard {
  const solution = pickProblemValue(solutions, random);
  const keepRatio = random();
  const cells: MagicSquareCell[] = solution.cells.map((cell) =>
    random() < keepRatio ? cell : null,
  );
  const used = new Set(cells.filter((cell) => cell !== null));
  const unusedValues = shuffleProblemValues(
    Array.from(
      { length: getMagicSquareMaxValue(solution.size) },
      (_, index) => index + 1,
    ).filter((value) => !used.has(value)),
    random,
  );
  const emptyCellIndices = shuffleProblemValues(
    cells.flatMap((cell, cellIndex) => (cell === null ? [cellIndex] : [])),
    random,
  );
  const insertedCount = Math.floor(random() * (emptyCellIndices.length + 1));
  emptyCellIndices.slice(0, insertedCount).forEach((cellIndex, index) => {
    cells[cellIndex] = unusedValues[index] ?? null;
  });
  return { size: solution.size, cells };
}

describe("正解の配置の場合", () => {
  test("回転・裏返し・補数をかけた十分な数の答えを試していること", () => {
    const count = solutions.length;

    expect(count).toBe(solutionRows.length * 16);
  });

  test("全部の列がそろえる合計と一致すること", () => {
    const allMatched = solutions.map((solution) =>
      listMagicSquareLineEvaluations(solution).every(
        ({ sum, status }) =>
          status === "matched" && sum === getMagicSquareMagicSum(solution.size),
      ),
    );

    expect(allMatched).toEqual(solutions.map(() => true));
  });

  test("解けたと判定すること", () => {
    const solved = solutions.map(isMagicSquareSolved);

    expect(solved).toEqual(solutions.map(() => true));
  });
});

describe("ランダムな途中の盤面の場合", () => {
  const random = createProblemSeededRandom("magic-square-rules");
  const samples = Array.from({ length: 600 }, () => {
    const board = createRandomPartialBoard(random);
    return { board, naive: judgeNaively(board) };
  });

  test("4種類の列の状態を全部含むこと", () => {
    const statuses = new Set(samples.flatMap(({ naive }) => naive.statuses));

    expect([...statuses].sort()).toEqual([
      "incomplete",
      "matched",
      "overreached",
      "unmatched",
    ]);
  });

  test("列ごとの今の合計と状態が素朴な判定器と一致すること", () => {
    const judgements = samples.map(({ board }) => {
      const evaluations = listMagicSquareLineEvaluations(board);
      return {
        sums: evaluations.map(({ sum }) => sum),
        statuses: evaluations.map(({ status }) => status),
      };
    });

    expect(judgements).toEqual(
      samples.map(({ naive }) => ({
        sums: naive.sums,
        statuses: naive.statuses,
      })),
    );
  });

  test("解けたかが素朴な判定器と一致すること", () => {
    const solved = samples.map(({ board }) => isMagicSquareSolved(board));

    expect(solved).toEqual(samples.map(({ naive }) => naive.solved));
  });

  test("列の状態は、その列のマスの数だけで決まり、ほかのマスの数に依らないこと", () => {
    const unchanged = samples.flatMap(({ board }) =>
      listMagicSquareLines(board.size).map((line) => {
        const lineCells = new Set(
          getMagicSquareLineCellIndices(board.size, line),
        );
        const otherCellsEmptied = {
          size: board.size,
          cells: board.cells.map((cell, cellIndex) =>
            lineCells.has(cellIndex) ? cell : null,
          ),
        };
        const original = evaluateMagicSquareLine(board, line);
        const isolated = evaluateMagicSquareLine(otherCellsEmptied, line);
        return (
          original.sum === isolated.sum && original.status === isolated.status
        );
      }),
    );

    expect(unchanged.every(Boolean)).toBe(true);
  });

  describe("盤面の数を最初から置いてある数とみなした場合", () => {
    const operationRandom = createProblemSeededRandom(
      "magic-square-rules-givens",
    );
    const givenCellOperations = samples.map(({ board: givens }) => ({
      givens,
      state: createMagicSquareInitialState(givens),
      operations: givens.cells.flatMap((cell, cellIndex) =>
        cell === null
          ? []
          : [
              {
                cellIndex,
                value:
                  Math.floor(
                    operationRandom() * getMagicSquareMaxValue(givens.size),
                  ) + 1,
              },
            ],
      ),
    }));
    type Operate = (
      givens: MagicSquareBoard,
      state: MagicSquareState,
      cellIndex: number,
      value: number,
    ) => MagicSquareState;
    const operates: readonly Operate[] = [
      placeMagicSquareValue,
      (givens, state, cellIndex) =>
        removeMagicSquareValue(givens, state, cellIndex),
      enterMagicSquareValue,
      toggleMagicSquareMemo,
    ];

    test("最初からある全部のマスで、置く・外す・入れる・メモを書く操作が受け取った状態をそのまま返すこと", () => {
      const changed = givenCellOperations.flatMap(
        ({ givens, state, operations }) =>
          operations.flatMap(({ cellIndex, value }) =>
            operates.filter(
              (operate) => operate(givens, state, cellIndex, value) !== state,
            ),
          ),
      );

      expect(changed).toEqual([]);
    });
  });
});

describe("evaluateMagicSquareLine", () => {
  const firstRow = { kind: "row", index: 0 } as const;
  const cases = [
    [
      "答えと違う数で埋まって合計がそろった列は一致",
      ["1 4 13 16", ". . . .", ". . . .", ". . . ."],
      { sum: 34, emptyCount: 0, status: "matched" },
    ],
    [
      "答えどおりの数でも空きが残る列は未完",
      ["14 4 5 .", ". . . .", ". . . .", ". . . ."],
      { sum: 23, emptyCount: 1, status: "incomplete" },
    ],
    [
      "空きがあるのに合計にちょうど届いた列は違反",
      ["16 15 3 .", ". . . .", ". . . .", ". . . ."],
      { sum: 34, emptyCount: 1, status: "overreached" },
    ],
    [
      "空きがあるのに合計を超えた列は違反",
      ["16 15 14 .", ". . . .", ". . . .", ". . . ."],
      { sum: 45, emptyCount: 1, status: "overreached" },
    ],
    [
      "埋まったのに合計と違う列は違反",
      ["1 2 3 4", ". . . .", ". . . .", ". . . ."],
      { sum: 10, emptyCount: 0, status: "unmatched" },
    ],
  ] as const;

  test.each(cases)("%sにすること", (_, rows, expected) => {
    const evaluation = evaluateMagicSquareLine(
      parseMagicSquareBoard(rows),
      firstRow,
    );

    expect(evaluation).toEqual({ line: firstRow, ...expected });
  });
});

describe("isMagicSquareLineViolation", () => {
  const cases = [
    ["incomplete", false],
    ["matched", false],
    ["unmatched", true],
    ["overreached", true],
  ] as const;

  test.each(cases)("%s を違反かで分けること", (status, expected) => {
    const violation = isMagicSquareLineViolation(status);

    expect(violation).toBe(expected);
  });
});

describe("changesMagicSquareLineVerdict", () => {
  const cases = [
    ["空きマス", [". 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"], 0, false],
    [
      "埋めた列が一致したマス",
      ["14 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"],
      0,
      true,
    ],
    [
      "埋めた列が違反になったマス",
      ["9 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"],
      0,
      true,
    ],
    [
      "空きのある列を合計に届かせたマス",
      ["16 15 14 .", ". . . .", ". . . .", ". . . ."],
      2,
      true,
    ],
    [
      "どの列も埋めず合計にも届かせないマス",
      [". 4 5 .", "9 2 . .", ". . 12 1", "3 . 10 6"],
      4,
      false,
    ],
    [
      "前から合計に届いていた列を埋めて違反のままのマス",
      ["16 15 14 1", ". . . .", ". . . .", ". . . ."],
      3,
      false,
    ],
  ] as const;

  test.each(cases)(
    "%sで、列の端の数の見え方が変わるかを返すこと",
    (_, rows, cellIndex, expected) => {
      const changed = changesMagicSquareLineVerdict(
        parseMagicSquareBoard(rows),
        cellIndex,
      );

      expect(changed).toBe(expected);
    },
  );
});

describe("isMagicSquareSolved", () => {
  const cases = [
    ["空きの残る盤面", ["14 4 5 11", "9 2 7 16", "8 13 12 1", "3 15 10 ."]],
    [
      "行と縦の列はそろっても斜めがそろわない盤面",
      ["4 14 5 11", "2 9 7 16", "13 8 12 1", "15 3 10 6"],
    ],
  ] as const;

  test.each(cases)("%sを解けたとしないこと", (_, rows) => {
    const solved = isMagicSquareSolved(parseMagicSquareBoard(rows));

    expect(solved).toBe(false);
  });
});

describe("最初から置いてある数がある 4×4 の盤面を操作する場合", () => {
  const givens = parseMagicSquareBoard([
    ". 4 5 .",
    ". 2 . .",
    ". . 12 1",
    "3 . 10 6",
  ]);
  const initial = createMagicSquareInitialState(givens);
  const givenCell = 1;
  const emptyCell = 0;
  const otherEmptyCell = 3;
  const placed = placeMagicSquareValue(givens, initial, emptyCell, 14);

  describe("placeMagicSquareValue", () => {
    test("空きマスに数を置くこと", () => {
      const state = placeMagicSquareValue(givens, initial, emptyCell, 14);

      expect(state.cells[emptyCell]).toBe(14);
    });

    test("置いた数を別の数に置き換えること", () => {
      const state = placeMagicSquareValue(givens, placed, emptyCell, 11);

      expect(state.cells[emptyCell]).toBe(11);
    });

    test("最初から置いてある数のマスを変えないこと", () => {
      const state = placeMagicSquareValue(givens, initial, givenCell, 14);

      expect(state).toBe(initial);
    });

    test("盤面にもう置いてある数をほかのマスに置かないこと", () => {
      const state = placeMagicSquareValue(givens, placed, otherEmptyCell, 14);

      expect(state).toBe(placed);
    });

    test("最初から置いてある数をほかのマスに置かないこと", () => {
      const state = placeMagicSquareValue(givens, initial, emptyCell, 4);

      expect(state).toBe(initial);
    });

    test.each([0, 17, 1.5])("範囲外の数 %s を置かないこと", (value) => {
      const state = placeMagicSquareValue(givens, initial, emptyCell, value);

      expect(state).toBe(initial);
    });

    describe("メモを書いたマスがある場合", () => {
      const memoed = [
        [emptyCell, 9],
        [emptyCell, 14],
        [otherEmptyCell, 9],
        [otherEmptyCell, 11],
      ].reduce(
        (state, [cellIndex, value]) =>
          toggleMagicSquareMemo(givens, state, cellIndex!, value!),
        initial,
      );
      const placedOnMemo = placeMagicSquareValue(givens, memoed, emptyCell, 9);

      test("置いた数を全部のマスのメモから消し、ほかの数のメモは残すこと", () => {
        const state = placeMagicSquareValue(givens, memoed, emptyCell, 9);

        expect([state.memos[emptyCell], state.memos[otherEmptyCell]]).toEqual([
          [14],
          [11],
        ]);
      });

      test("置いた数を外すと、そのマスに残したメモがまた空きマスのメモになること", () => {
        const state = removeMagicSquareValue(givens, placedOnMemo, emptyCell);

        expect([state.cells[emptyCell], state.memos[emptyCell]]).toEqual([
          null,
          [14],
        ]);
      });
    });
  });

  describe("canPlaceMagicSquareValue", () => {
    const cases = [
      ["空きマスにまだ置いていない数", otherEmptyCell, 11, true],
      ["置いたマスに別の数", emptyCell, 11, true],
      ["置いたマスに同じ数", emptyCell, 14, false],
      ["ほかのマスに置いた数", otherEmptyCell, 14, false],
      ["最初から置いてある数のマス", givenCell, 11, false],
      ["盤面の外", 16, 11, false],
    ] as const;

    test.each(cases)(
      "%sを置けるかを返すこと",
      (_, cellIndex, value, expected) => {
        const placeable = canPlaceMagicSquareValue(
          givens,
          placed,
          cellIndex,
          value,
        );

        expect(placeable).toBe(expected);
      },
    );
  });

  describe("removeMagicSquareValue", () => {
    test("置いた数を外すこと", () => {
      const state = removeMagicSquareValue(givens, placed, emptyCell);

      expect(state.cells[emptyCell]).toBeNull();
    });

    test("最初から置いてある数を外さないこと", () => {
      const state = removeMagicSquareValue(givens, placed, givenCell);

      expect(state).toBe(placed);
    });

    test("空きマスでは何もしないこと", () => {
      const state = removeMagicSquareValue(givens, placed, otherEmptyCell);

      expect(state).toBe(placed);
    });
  });

  describe("toggleMagicSquareMemo", () => {
    const written = toggleMagicSquareMemo(givens, initial, emptyCell, 7);

    test("メモに数を小さい順に書くこと", () => {
      const state = [11, 7, 9].reduce(
        (current, value) =>
          toggleMagicSquareMemo(givens, current, emptyCell, value),
        initial,
      );

      expect(state.memos[emptyCell]).toEqual([7, 9, 11]);
    });

    test("書いてある数をもう一度書くと消すこと", () => {
      const state = toggleMagicSquareMemo(givens, written, emptyCell, 7);

      expect(state.memos[emptyCell]).toEqual([]);
    });

    const unchangedCases: readonly [
      string,
      MagicSquareState,
      number,
      number,
    ][] = [
      ["最初から置いてある数のマス", initial, givenCell, 7],
      ["数を置いたマス", placed, emptyCell, 7],
      ["盤面に置いてある数", placed, otherEmptyCell, 14],
      ["範囲外の数", initial, emptyCell, 17],
    ];

    test.each(unchangedCases)(
      "%sにはメモを書かないこと",
      (_, state, cellIndex, value) => {
        const next = toggleMagicSquareMemo(givens, state, cellIndex, value);

        expect(next).toBe(state);
      },
    );

    describe("メモが上限まで埋まったマスの場合", () => {
      const fullValues = [7, 8, 9, 11, 13].slice(0, MAGIC_SQUARE_MEMO_CAPACITY);
      const full = fullValues.reduce(
        (current, value) =>
          toggleMagicSquareMemo(givens, current, emptyCell, value),
        initial,
      );

      test("新しい数を書かないこと", () => {
        const next = toggleMagicSquareMemo(givens, full, emptyCell, 15);

        expect(next).toBe(full);
      });

      test("書いてある数は消せること", () => {
        const next = toggleMagicSquareMemo(
          givens,
          full,
          emptyCell,
          fullValues[0]!,
        );

        expect(next.memos[emptyCell]).toEqual(fullValues.slice(1));
      });
    });
  });

  describe("findMagicSquareMemoRejection", () => {
    const full = [7, 8, 9, 11, 13]
      .slice(0, MAGIC_SQUARE_MEMO_CAPACITY)
      .reduce(
        (current, value) =>
          toggleMagicSquareMemo(givens, current, otherEmptyCell, value),
        placed,
      );
    const cases: readonly [
      string,
      number,
      number,
      MagicSquareMemoRejection | null,
    ][] = [
      ["メモの無い空きマス", 4, 7, null],
      ["メモが上限まで埋まったマスに書いてある数", otherEmptyCell, 7, null],
      [
        "メモが上限まで埋まったマスにまだ書いていない数",
        otherEmptyCell,
        15,
        "full",
      ],
      ["数を置いたマス", emptyCell, 7, "not-empty-cell"],
      ["最初から置いてある数のマス", givenCell, 7, "not-empty-cell"],
      ["盤面に置いてある数", otherEmptyCell, 14, "used-value"],
    ];

    test.each(cases)(
      "%sでは、メモに書けない・消せないわけを返し、書ける・消せるときは null を返すこと",
      (_, cellIndex, value, expected) => {
        const rejection = findMagicSquareMemoRejection(
          givens,
          full,
          cellIndex,
          value,
        );

        expect(rejection).toBe(expected);
      },
    );
  });

  describe("enterMagicSquareValue", () => {
    const cases = [
      ["空きマスにまだ置いていない数を押すと置く", initial, emptyCell, 14, 14],
      ["置いた数のマスで別の数を押すと置き換える", placed, emptyCell, 11, 11],
      ["置いた数のマスで同じ数を押すと外す", placed, emptyCell, 14, null],
    ] as const;

    test.each(cases)("%sこと", (_, state, cellIndex, value, expected) => {
      const next = enterMagicSquareValue(givens, state, cellIndex, value);

      expect(next.cells[cellIndex]).toBe(expected);
    });

    test("最初から置いてある数のマスで同じ数を押しても外さないこと", () => {
      const next = enterMagicSquareValue(givens, initial, givenCell, 4);

      expect(next).toBe(initial);
    });
  });

  describe("listMagicSquareValueStates", () => {
    test("選んだマスの数を selected、ほかに置いた数と最初から置いてある数を used、残りを available にすること", () => {
      const states = listMagicSquareValueStates(givens, placed, emptyCell);

      expect(states).toEqual([
        "used",
        "used",
        "used",
        "used",
        "used",
        "used",
        "available",
        "available",
        "available",
        "used",
        "available",
        "used",
        "available",
        "selected",
        "available",
        "available",
      ]);
    });

    test("最初から置いてある数のマスを選んでも、その数を used にすること", () => {
      const states = listMagicSquareValueStates(givens, placed, givenCell);

      expect(states[3]).toBe("used");
    });
  });

  describe("listMagicSquareMemoValueStates", () => {
    const memoed = [9, 13].reduce(
      (current, value) =>
        toggleMagicSquareMemo(givens, current, otherEmptyCell, value),
      placed,
    );
    const placedOnMemo = placeMagicSquareValue(
      givens,
      memoed,
      otherEmptyCell,
      11,
    );

    test("選んだ空きマスのメモにある数を selected、盤面に置いてある数を used、残りを available にすること", () => {
      const states = listMagicSquareMemoValueStates(memoed, otherEmptyCell);

      expect(states).toEqual([
        "used",
        "used",
        "used",
        "used",
        "used",
        "used",
        "available",
        "available",
        "selected",
        "used",
        "available",
        "used",
        "selected",
        "used",
        "available",
        "available",
      ]);
    });

    test("数を置いたマスを選ぶと、そのマスの数も used にし、メモの数を selected にしないこと", () => {
      const states = listMagicSquareMemoValueStates(
        placedOnMemo,
        otherEmptyCell,
      );

      expect([states[8], states[10], states[12]]).toEqual([
        "available",
        "used",
        "available",
      ]);
    });
  });

  describe("listMagicSquareUsedValues", () => {
    test("最初から置いてある数と置いた数を返すこと", () => {
      const used = listMagicSquareUsedValues(placed);

      expect([...used].sort((left, right) => left - right)).toEqual([
        1, 2, 3, 4, 5, 6, 10, 12, 14,
      ]);
    });
  });

  describe("findMagicSquareValueCell", () => {
    test("数を置いたマスを返し、置いていない数には null を返すこと", () => {
      const found = [
        findMagicSquareValueCell(initial, 12),
        findMagicSquareValueCell(initial, 14),
      ];

      expect(found).toEqual([10, null]);
    });
  });
});
