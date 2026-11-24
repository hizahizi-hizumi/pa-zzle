import type { MagicSquareProblem } from "@/games/magic-square/problem/problem";
import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";
import {
  canRestartMagicSquareSession,
  canUndoMagicSquareSession,
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  getMagicSquareSessionCorrectionCount,
  getMagicSquareSessionResult,
  listMagicSquareSessionValueStates,
  type MagicSquareSession,
  restartMagicSquareSession,
  selectMagicSquareSessionCell,
  toggleMagicSquareSessionMemo,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";

/**
 * 答えは `14 4 5 11 / 9 2 7 16 / 8 13 12 1 / 3 15 10 6`。左上は右下がりの斜めの最後の空き、右上は1行目の最後の空きで、
 * 置くと列が埋まる。2行目の左端と右端は、始めの盤面ではどの列も埋めない。数の欄は8列で、13 と 14、8 と 7、7 と 14 は隣り合い、9 と 14 は隣り合わない。
 */
const problem: MagicSquareProblem = {
  givens: parseMagicSquareBoard([". 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"]),
};
const startedAt = 1_000;
const topLeft = 0;
const topRight = 3;
const secondRowLeft = 4;
const secondRowRight = 7;
const thirdRowLeft = 8;
const givenCell = 1;

/**
 * - `select`: マスを選ぶ。
 * - 数: 選んだマスに数の欄のその数を押す。
 * - `memo:<数>`: 選んだマスのメモにその数を書く。
 */
type Operation =
  | { select: number }
  | number
  | `memo:${number}`
  | "undo"
  | "restart";

function play(operations: readonly Operation[]): MagicSquareSession {
  return operations.reduce(
    (session, operation, index) => {
      const operatedAt = startedAt + (index + 1) * 1_000;
      if (typeof operation === "number") {
        return enterMagicSquareSessionValue(session, operation, operatedAt);
      }
      if (operation === "undo") {
        return undoMagicSquareSession(session);
      }
      if (operation === "restart") {
        return restartMagicSquareSession(session);
      }
      if (typeof operation === "string") {
        return toggleMagicSquareSessionMemo(
          session,
          Number(operation.slice("memo:".length)),
          operatedAt,
        );
      }
      return selectMagicSquareSessionCell(session, operation.select);
    },
    createMagicSquareSession(problem, startedAt),
  );
}

const solvingOperations: readonly Operation[] = [
  { select: 0 },
  14,
  { select: 3 },
  11,
  { select: 4 },
  9,
  { select: 6 },
  7,
  { select: 7 },
  16,
  { select: 8 },
  8,
  { select: 9 },
  13,
  { select: 13 },
  15,
];

describe("createMagicSquareSession", () => {
  const session = createMagicSquareSession(problem, startedAt);
  const violatedProblem: MagicSquareProblem = {
    givens: parseMagicSquareBoard(["1 2 3 4", ". . . .", ". . . .", ". . . ."]),
  };

  test("最初から置いてある数の盤面で、どのマスも選ばずに始めること", () => {
    const { status, puzzleState, selectedCellIndex } = session;

    expect({ status, cells: puzzleState.cells, selectedCellIndex }).toEqual({
      status: "playing",
      cells: problem.givens.cells,
      selectedCellIndex: null,
    });
  });

  test("最初から置いてある数で違反の列がある問題を受け付けないこと", () => {
    const act = () => createMagicSquareSession(violatedProblem, startedAt);

    expect(act).toThrow(RangeError);
  });
});

describe("selectMagicSquareSessionCell", () => {
  const cases = [
    ["空きマス", topLeft],
    ["最初から置いてある数のマス", givenCell],
  ] as const;

  test.each(cases)("%sを選ぶこと", (_, cellIndex) => {
    const session = play([{ select: cellIndex }]);

    expect(session.selectedCellIndex).toBe(cellIndex);
  });

  test("盤面の外は選ばないこと", () => {
    const session = play([{ select: 16 }]);

    expect(session.selectedCellIndex).toBeNull();
  });
});

describe("enterMagicSquareSessionValue", () => {
  const cases: readonly [string, readonly Operation[], number | null][] = [
    ["選んだ空きマスに数を置く", [{ select: topLeft }, 14], 14],
    ["選んだマスに別の数を押すと置き換える", [{ select: topLeft }, 14, 9], 9],
    ["選んだマスに同じ数を押すと外す", [{ select: topLeft }, 14, 14], null],
    [
      "ほかのマスに置いた数は置かない",
      [{ select: topRight }, 14, { select: topLeft }, 14],
      null,
    ],
    ["マスを選んでいなければ置かない", [14], null],
  ];

  test.each(cases)("%sこと", (_, operations, expected) => {
    const session = play(operations);

    expect(session.puzzleState.cells[topLeft]).toBe(expected);
  });

  test("最初から置いてある数のマスを変えないこと", () => {
    const session = play([{ select: givenCell }, 4]);

    expect(session.puzzleState.cells[givenCell]).toBe(4);
  });
});

describe("getMagicSquareSessionCorrectionCount", () => {
  const cases: readonly [string, readonly Operation[], number][] = [
    [
      "列の見え方を変えない数を、ほかのマスに触れる前に置き換えても数えない",
      [{ select: secondRowLeft }, 13, 9],
      0,
    ],
    [
      "列の見え方を変えない数を、置いた直後に待ったで外しても数えない",
      [{ select: secondRowLeft }, 9, "undo"],
      0,
    ],
    [
      "列の見え方を変えない数を、置いた直後に同じ数で外しても数えない",
      [{ select: secondRowLeft }, 9, 9],
      0,
    ],
    [
      "埋めた列が違反になった数を、ほかのマスに触れる前に置き換えても数える",
      [{ select: topLeft }, 9, 14],
      1,
    ],
    [
      "埋めた列が違反になった数を、置いた直後に待ったで外しても数える",
      [{ select: topLeft }, 9, "undo"],
      1,
    ],
    [
      "埋めた列が違反になった数を、置いた直後に同じ数で外しても数える",
      [{ select: topLeft }, 9, 9],
      1,
    ],
    [
      "埋めた列が一致した数を、置いた直後に外しても数える",
      [{ select: topLeft }, 14, 14],
      1,
    ],
    [
      "空きのある列を合計に届かせた数を、ほかのマスに触れる前に置き換えても数える",
      [{ select: thirdRowLeft }, 16, { select: secondRowLeft }, 15, 9],
      1,
    ],
    [
      "列が一致するまで数を試すと、試した数をどれも数える",
      [{ select: topLeft }, 8, 9, 11, 14],
      3,
    ],
    [
      "列の見え方を変えた数を、数の欄で隣り合う数へ置き換えたのは押し間違いの直しとして数えない",
      [{ select: topLeft }, 13, 14],
      0,
    ],
    [
      "列の見え方を変えた数を外してから、数の欄で隣り合う数を置いたのも数えない",
      [{ select: topLeft }, 13, 13, 14],
      0,
    ],
    [
      "列の見え方を変えた数を待ったで外してから、数の欄で隣り合う数を置いたのも数えない",
      [{ select: topLeft }, 13, "undo", 14],
      0,
    ],
    [
      "隣り合う数へ直すのを続けても、数えないのは1つ目だけ",
      [{ select: topLeft }, 8, 7, 14],
      1,
    ],
    [
      "置いてあった数を隣り合う数へ押し間違えて、すぐ戻したのは数えない",
      [
        { select: topLeft },
        14,
        { select: topRight },
        { select: topLeft },
        13,
        14,
      ],
      0,
    ],
    [
      "外した数をすぐ同じマスへ戻したのは数えない",
      [
        { select: topLeft },
        14,
        { select: topRight },
        { select: topLeft },
        14,
        14,
      ],
      0,
    ],
    [
      "外した数を待ったで戻したのは数えない",
      [
        { select: topLeft },
        14,
        { select: topRight },
        { select: topLeft },
        14,
        "undo",
      ],
      0,
    ],
    [
      "ほかのマスを選んでから戻って置き換えると数える",
      [
        { select: secondRowLeft },
        13,
        { select: secondRowRight },
        { select: secondRowLeft },
        9,
      ],
      1,
    ],
    [
      "ほかのマスに置いてから外すと数える",
      [
        { select: secondRowLeft },
        9,
        { select: secondRowRight },
        16,
        { select: secondRowLeft },
        9,
      ],
      1,
    ],
    [
      "ほかのマスに置いてから待ったで外したのも数える",
      [
        { select: secondRowLeft },
        9,
        { select: secondRowRight },
        16,
        "undo",
        "undo",
      ],
      1,
    ],
    [
      "盤面を戻すと、盤面にあった置いた数をどれも数える",
      [{ select: secondRowLeft }, 9, { select: secondRowRight }, 16, "restart"],
      2,
    ],
    [
      "置き換えた後に盤面を戻すと、置き換えた数と戻した数を別に数える",
      [
        { select: secondRowLeft },
        13,
        { select: secondRowRight },
        { select: secondRowLeft },
        9,
        "restart",
      ],
      2,
    ],
    [
      "列の見え方を変えた数を直してから盤面を戻しても、直した数を数え続ける",
      [{ select: topLeft }, 9, 14, "restart"],
      2,
    ],
    [
      "メモを書いたマスに数を置いて直すのは、同じマスの直しとして数えない",
      [{ select: secondRowLeft }, "memo:9", "memo:13", 13, 9],
      0,
    ],
  ];

  test.each(cases)("%sこと", (_, operations, expected) => {
    const count = getMagicSquareSessionCorrectionCount(play(operations));

    expect(count).toBe(expected);
  });
});

describe("toggleMagicSquareSessionMemo", () => {
  test("選んだ空きマスのメモに書き、待ったで消せること", () => {
    const sessions = [
      play([{ select: secondRowLeft }, "memo:9"]),
      play([{ select: secondRowLeft }, "memo:9", "undo"]),
    ];

    expect(sessions.map(({ puzzleState }) => puzzleState.memos[4])).toEqual([
      [9],
      [],
    ]);
  });

  test("数を置くと、その数を全部のマスのメモから消すこと", () => {
    const session = play([
      { select: secondRowLeft },
      "memo:9",
      { select: topLeft },
      "memo:9",
      9,
    ]);

    expect(session.puzzleState.memos[secondRowLeft]).toEqual([]);
  });
});

describe("undoMagicSquareSession", () => {
  const placed = play([{ select: topLeft }, 14, { select: topRight }, 11]);
  const initial = createMagicSquareSession(problem, startedAt);

  test("直前の盤面操作を取り消し、待ったの回数を数えること", () => {
    const session = undoMagicSquareSession(placed);

    expect([session.puzzleState.cells[topRight], session.undoCount]).toEqual([
      null,
      1,
    ]);
  });

  test("盤面操作の無いプレイでは何もしないこと", () => {
    const session = undoMagicSquareSession(initial);

    expect(session).toBe(initial);
  });
});

describe("restartMagicSquareSession", () => {
  const placed = play([
    { select: topLeft },
    14,
    { select: topRight },
    "memo:11",
  ]);

  test("盤面とメモを初期状態へ戻し、盤面を戻した回数を数えること", () => {
    const session = restartMagicSquareSession(placed);

    expect({
      cells: session.puzzleState.cells,
      memos: session.puzzleState.memos.flat(),
      restartCount: session.restartCount,
      canUndo: canUndoMagicSquareSession(session),
    }).toEqual({
      cells: problem.givens.cells,
      memos: [],
      restartCount: 1,
      canUndo: false,
    });
  });
});

describe("canRestartMagicSquareSession", () => {
  const cases: readonly [string, readonly Operation[], boolean][] = [
    ["初期状態", [], false],
    ["メモだけを書いた盤面", [{ select: topLeft }, "memo:9"], true],
    ["数を置いた盤面", [{ select: topLeft }, 14], true],
    ["解き終えた盤面", solvingOperations, false],
  ];

  test.each(cases)(
    "%sで盤面を戻せるかを返すこと",
    (_, operations, expected) => {
      const restartable = canRestartMagicSquareSession(play(operations));

      expect(restartable).toBe(expected);
    },
  );
});

describe("解き終えた場合", () => {
  const cleared = play(solvingOperations);

  test("最後の数を置いた時刻でクリアし、選びを外すこと", () => {
    const { status, clearedAt, selectedCellIndex } = cleared;

    expect({ status, clearedAt, selectedCellIndex }).toEqual({
      status: "cleared",
      clearedAt: startedAt + solvingOperations.length * 1_000,
      selectedCellIndex: null,
    });
  });

  test("クリア後の操作を受け付けないこと", () => {
    const sessions = [
      selectMagicSquareSessionCell(cleared, topLeft),
      enterMagicSquareSessionValue(cleared, 14, startedAt),
      undoMagicSquareSession(cleared),
      restartMagicSquareSession(cleared),
    ];

    expect(sessions.every((session) => session === cleared)).toBe(true);
  });

  test("経過時間と置き直し・待った・盤面を戻した回数を結果に返すこと", () => {
    const result = getMagicSquareSessionResult(cleared);

    expect(result).toEqual({
      elapsedMs: solvingOperations.length * 1_000,
      correctionCount: 0,
      undoCount: 0,
      restartCount: 0,
    });
  });
});

describe("getMagicSquareSessionResult", () => {
  test("解き終えていないプレイには null を返すこと", () => {
    const result = getMagicSquareSessionResult(play([{ select: topLeft }, 14]));

    expect(result).toBeNull();
  });
});

describe("listMagicSquareSessionValueStates", () => {
  test("数を入れるときは、選んだマスに置いた数を selected、ほかに置いた数を used として返すこと", () => {
    const states = listMagicSquareSessionValueStates(
      play([{ select: topRight }, 11, { select: topLeft }, 14]),
      "value",
    );

    expect([states[10], states[13], states[8]]).toEqual([
      "used",
      "selected",
      "available",
    ]);
  });

  test("メモを書くときは、選んだマスのメモにある数を selected、盤面に置いた数を used として返すこと", () => {
    const states = listMagicSquareSessionValueStates(
      play([{ select: topRight }, 11, { select: topLeft }, "memo:9"]),
      "memo",
    );

    expect([states[10], states[8], states[13]]).toEqual([
      "used",
      "selected",
      "available",
    ]);
  });
});
