import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";
import {
  clearNanpureSessionCell,
  enterNanpureSessionDigit,
  findNanpureSessionCompletedDigits,
  findNanpureSessionMistakeCellIndices,
  type NanpureSession,
  toggleNanpureSessionNote,
} from "@/games/nanpure/session/session";
import {
  _private,
  createNanpureExampleSession,
  getNanpureExampleCellIndex,
  getNanpureExampleInputAvailability,
  inputNanpureExampleDigit,
  judgeNanpureExampleUnit,
  listNanpureExampleCellIndices,
  listNanpureExampleConflictKinds,
  listNanpureExampleOtherConflictKinds,
  type NanpureHowToPlayBoard,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import {
  blockRuleExample,
  columnRuleExample,
  completedDigitAssistExample,
  enterOperationExample,
  eraseOperationExample,
  givenRuleExample,
  goalBoard,
  mistakeAssistExample,
  type NanpureHowToPlayExample,
  notesClearedAssistExample,
  notesOperationExample,
  replaceOperationExample,
  rowRuleExample,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";

const { exampleSolution } = _private;

const block: NanpureHowToPlayBoard = {
  region: { row: 0, column: 0, rowCount: 3, columnCount: 3 },
  rows: ["6 . +8", "3 . 1", "+7 2 +3"],
  notes: [{ at: [0, 1], digits: [1, 5] }],
};

function getFirstBoard({
  boards,
}: NanpureHowToPlayExample): NanpureHowToPlayBoard {
  const [first] = boards;
  if (first === undefined) {
    throw new Error("example has no board");
  }
  return first;
}

/** 手がかりの手を、面の1つ目の盤面に順に打った後の盤面と、メモの入れ方。 */
function followHints(example: NanpureHowToPlayExample): {
  session: NanpureSession;
  notesMode: boolean;
} {
  let session = createNanpureExampleSession(getFirstBoard(example));
  let selected = -1;
  let notesMode = false;
  for (const press of example.hints) {
    switch (press.kind) {
      case "cell":
        selected = press.cellIndex;
        break;
      case "notes":
        notesMode = !notesMode;
        break;
      case "erase":
        session = clearNanpureSessionCell(session, selected);
        break;
      case "digit":
        session = inputNanpureExampleDigit(
          session,
          selected,
          press.digit,
          notesMode,
        ).session;
        break;
    }
  }
  return { session, notesMode };
}

describe("_private.exampleSolution", () => {
  test("完成した盤面であること", () => {
    const solved = isNanpureSolved(exampleSolution);

    expect(solved).toBe(true);
  });
});

describe("createNanpureExampleSession", () => {
  const unmatchedRows: NanpureHowToPlayBoard = {
    ...block,
    rows: ["6 5", "3 . 1", "7 2 4"],
  };

  test("範囲の数字を、最初からある数字と入れた数字に分けて、範囲の外を空きにすること", () => {
    const session = createNanpureExampleSession(block);

    expect(session.problem.clues.slice(0, 3)).toEqual([6, null, null]);
    expect(session.puzzleState.slice(0, 3)).toEqual([6, null, 8]);
    expect(session.puzzleState.slice(18, 21)).toEqual([7, 2, 3]);
    expect(session.puzzleState.filter((cell) => cell !== null)).toHaveLength(7);
    expect(session.notes[1]).toEqual([1, 5]);
  });

  test("範囲の列の数と合わない行を受け付けないこと", () => {
    const create = () => createNanpureExampleSession(unmatchedRows);

    expect(create).toThrow(RangeError);
  });

  test("入口の盤面の最初からある数字を、答えの一部にすること", () => {
    const { clues } = createNanpureExampleSession(goalBoard).problem;

    const matches = clues.every(
      (cell, cellIndex) => cell === null || cell === exampleSolution[cellIndex],
    );

    expect(matches).toBe(true);
  });
});

describe("inputNanpureExampleDigit", () => {
  const session = createNanpureExampleSession(block);
  const cellIndex = getNanpureExampleCellIndex(block.region, [1, 1]);
  const memoCell = getNanpureExampleCellIndex(block.region, [0, 1]);
  const enteredBySession = enterNanpureSessionDigit(session, cellIndex, 9, 0);
  const noteAddedBySession = toggleNanpureSessionNote(session, memoCell, 4);

  test("答えの数字を入れると、本番の session と同じ盤面にし、入れた音にすること", () => {
    const result = inputNanpureExampleDigit(session, cellIndex, 9, false);

    expect(result.session).toEqual(enteredBySession);
    expect(result.sound).toBe("digit-entered");
  });

  test("答えと違う数字を入れると、ミスの音にすること", () => {
    const result = inputNanpureExampleDigit(session, cellIndex, 4, false);

    expect(result.sound).toBe("mistake-entered");
  });

  test("メモをオンにして書くと、本番の session と同じくメモを書き、メモを書く音にすること", () => {
    const added = inputNanpureExampleDigit(session, memoCell, 4, true);

    expect(added.session).toEqual(noteAddedBySession);
    expect(added.sound).toBe("note-added");
  });

  test("メモをオンにして書いてある数字を押すと、メモを消し、メモを消す音にすること", () => {
    const removed = inputNanpureExampleDigit(session, memoCell, 5, true);

    expect(removed.session.notes[memoCell]).toEqual([1]);
    expect(removed.sound).toBe("note-removed");
  });

  test("最初からある数字のマスでは、盤面を変えず音も鳴らさないこと", () => {
    const result = inputNanpureExampleDigit(session, 0, 4, false);

    expect(result).toEqual({ session, sound: null });
  });
});

describe("getNanpureExampleInputAvailability", () => {
  const session = createNanpureExampleSession(block);

  describe.each([
    { at: [0, 0], notesMode: false, canEnterDigit: false, canErase: false },
    { at: [0, 2], notesMode: false, canEnterDigit: true, canErase: true },
    { at: [0, 2], notesMode: true, canEnterDigit: false, canErase: true },
    { at: [0, 1], notesMode: true, canEnterDigit: true, canErase: true },
    { at: [1, 1], notesMode: false, canEnterDigit: true, canErase: false },
  ] as const)(
    "$at のマスを選びメモが $notesMode の場合",
    ({ at, notesMode, canEnterDigit, canErase }) => {
      const cellIndex = getNanpureExampleCellIndex(block.region, at);

      test(`本番の入力の段と同じく、数字は ${canEnterDigit}・消すは ${canErase} で押せること`, () => {
        const availability = getNanpureExampleInputAvailability(
          session,
          cellIndex,
          notesMode,
        );

        expect(availability.canEnterDigit).toBe(canEnterDigit);
        expect(availability.canErase).toBe(canErase);
      });
    },
  );

  describe("マスを選んでいない場合", () => {
    test("どのボタンも押せないこと", () => {
      const availability = getNanpureExampleInputAvailability(
        session,
        null,
        false,
      );

      expect(availability.canEnterDigit).toBe(false);
      expect(availability.canErase).toBe(false);
    });
  });
});

const ruleExamples = [
  { name: "行", example: rowRuleExample },
  { name: "列", example: columnRuleExample },
  { name: "ブロック", example: blockRuleExample },
];

describe("judgeNanpureExampleUnit", () => {
  describe.each(ruleExamples)("$name の例の場合", ({ example }) => {
    const [allowed, disallowed] = example.boards;
    if (allowed === undefined || disallowed === undefined) {
      throw new Error("rule example must have a pair");
    }
    const allowedSession = createNanpureExampleSession(allowed);
    const disallowedSession = createNanpureExampleSession(disallowed);
    const { session: followed } = followHints(example);

    test("できる形をできる、できない形をできないとすること", () => {
      const allowedVerdict = judgeNanpureExampleUnit(
        allowedSession,
        allowed.region,
      );
      const disallowedVerdict = judgeNanpureExampleUnit(
        disallowedSession,
        disallowed.region,
      );

      expect(allowedVerdict).toBe("allowed");
      expect(disallowedVerdict).toBe("disallowed");
    });

    test("できる形に手がかりの手を打った後を、できないとすること", () => {
      const verdict = judgeNanpureExampleUnit(followed, allowed.region);

      expect(verdict).toBe("disallowed");
    });
  });

  describe("空きがあり重ならない行の場合", () => {
    const region = { row: 0, column: 0, rowCount: 1, columnCount: 9 };
    const session = createNanpureExampleSession({
      region,
      rows: ["6 5 8 7 . 9 3 1 4"],
    });

    test("途中とすること", () => {
      const verdict = judgeNanpureExampleUnit(session, region);

      expect(verdict).toBe("incomplete");
    });
  });

  describe("答えと違う数字の例に手がかりの手を打った場合", () => {
    const { session } = followHints(mistakeAssistExample);
    const { region } = getFirstBoard(mistakeAssistExample);

    test("重ならないので、途中とすること", () => {
      const verdict = judgeNanpureExampleUnit(session, region);

      expect(verdict).toBe("incomplete");
    });
  });
});

describe("listNanpureExampleOtherConflictKinds", () => {
  describe.each(ruleExamples)("$name の例の場合", ({ example }) => {
    const [allowed, disallowed] = example.boards;
    if (allowed === undefined || disallowed === undefined) {
      throw new Error("rule example must have a pair");
    }
    const disallowedSession = createNanpureExampleSession(disallowed);
    const { session: followed } = followHints(example);

    test("できない形は、例が教えるまとまりのほかでは重ならないこと", () => {
      const others = listNanpureExampleOtherConflictKinds(
        disallowedSession,
        disallowed.region,
      );

      expect(others).toEqual([]);
    });

    test("手がかりの手を打っても、例が教えるまとまりのほかでは重ならないこと", () => {
      const others = listNanpureExampleOtherConflictKinds(
        followed,
        allowed.region,
      );

      expect(others).toEqual([]);
    });
  });

  describe("同じブロックの中でも重なる行の場合", () => {
    const region = { row: 0, column: 0, rowCount: 1, columnCount: 9 };
    const session = createNanpureExampleSession({
      region,
      rows: ["6 +6 8 7 2 9 3 1 4"],
    });

    test("ブロックを挙げること", () => {
      const others = listNanpureExampleOtherConflictKinds(session, region);

      expect(others).toEqual(["block"]);
    });
  });

  describe("答えと違う数字の例に手がかりの手を打った場合", () => {
    const { session } = followHints(mistakeAssistExample);
    const { region } = getFirstBoard(mistakeAssistExample);

    test("どのまとまりも挙げないこと", () => {
      const others = listNanpureExampleOtherConflictKinds(session, region);

      expect(others).toEqual([]);
    });
  });
});

describe("listNanpureExampleConflictKinds", () => {
  describe("入れ替えの例の最初の盤面の場合", () => {
    const board = getFirstBoard(replaceOperationExample);
    const session = createNanpureExampleSession(board);

    test("答えと違う数字があっても重ならないので、どのまとまりも挙げないこと", () => {
      const kinds = listNanpureExampleConflictKinds(session, board.region);

      expect(kinds).toEqual([]);
    });
  });
});

describe("最初からある数字のルールの例の場合", () => {
  const session = createNanpureExampleSession(getFirstBoard(givenRuleExample));
  const [press] = givenRuleExample.hints;

  test("手がかりは、最初からある数字のマスを選ぶ手であること", () => {
    const clue =
      press?.kind === "cell" ? session.problem.clues[press.cellIndex] : null;

    expect(press?.kind).toBe("cell");
    expect(clue).not.toBeNull();
  });
});

describe("入れ方の例の場合", () => {
  const board = getFirstBoard(enterOperationExample);
  const before = createNanpureExampleSession(board);
  const { session: after } = followHints(enterOperationExample);

  test("ブロックの空きが1つで、答えが盤面から決まること", () => {
    const blanks = listNanpureExampleCellIndices(board.region).filter(
      (cellIndex) => before.puzzleState[cellIndex] === null,
    );

    expect(blanks).toEqual([10]);
  });

  test("手がかりの手で、答えの数字が入ること", () => {
    const mistakes = findNanpureSessionMistakeCellIndices(after);

    expect(after.puzzleState[10]).toBe(9);
    expect(mistakes).toEqual([]);
  });
});

describe("入れ替えの例の場合", () => {
  const before = createNanpureExampleSession(
    getFirstBoard(replaceOperationExample),
  );
  const { session: after } = followHints(replaceOperationExample);

  test("最初は、入れた数字が答えと違うこと", () => {
    const mistakes = findNanpureSessionMistakeCellIndices(before);

    expect(mistakes).toEqual([10]);
  });

  test("手がかりの手で、答えの数字に入れ替わること", () => {
    const mistakes = findNanpureSessionMistakeCellIndices(after);

    expect(after.puzzleState[10]).toBe(9);
    expect(mistakes).toEqual([]);
  });
});

describe("答えと違う数字の例の場合", () => {
  const { session } = followHints(mistakeAssistExample);

  test("手がかりの手で、答えと違う数字を入れること", () => {
    const mistakes = findNanpureSessionMistakeCellIndices(session);

    expect(mistakes).toEqual([1]);
  });
});

describe("9つそろう例の場合", () => {
  const before = createNanpureExampleSession(
    getFirstBoard(completedDigitAssistExample),
  );
  const { session: after } = followHints(completedDigitAssistExample);

  test("最初は、どの数字もそろっていないこと", () => {
    const completed = findNanpureSessionCompletedDigits(before);

    expect(completed).toEqual([]);
  });

  test("手がかりの手で、5がそろうこと", () => {
    const completed = findNanpureSessionCompletedDigits(after);

    expect(completed).toEqual([5]);
  });
});

describe("消す例の場合", () => {
  const { session } = followHints(eraseOperationExample);

  test("手がかりの手で、入れた数字が消えること", () => {
    const cell = session.puzzleState[10];

    expect(cell).toBeNull();
  });
});

describe("メモの例の場合", () => {
  const before = createNanpureExampleSession(
    getFirstBoard(notesOperationExample),
  );
  const { session, notesMode } = followHints(notesOperationExample);

  test("手がかりの手で、メモをオンにして書いた数字を消し、元のメモに戻ること", () => {
    const notes = session.notes[1];

    expect(notesMode).toBe(true);
    expect(notes).toEqual(before.notes[1]);
  });
});

describe("メモが消える例の場合", () => {
  const { session } = followHints(notesClearedAssistExample);

  test("手がかりの手で、同じブロックのメモから5だけが消えること", () => {
    const notes = [session.notes[9], session.notes[11], session.notes[20]];

    expect(notes).toEqual([[3], [1, 4], [4]]);
  });
});
