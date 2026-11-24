import {
  isFukumenzanSolved,
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import {
  createExamplePuzzleState,
  describeOtherRuleMark,
  findExampleHint,
  getExampleLetterIndex,
  isExampleChanged,
  judgeExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  crossOperationExample,
  dragOperationExample,
  goalSteps,
  howToPlayProblem,
  leadingZeroRuleExamples,
  moveOperationExample,
  returnOperationExample,
  sumRuleExamples,
  tapOperationExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

const D = getExampleLetterIndex("D");
const U = getExampleLetterIndex("U");
const R = getExampleLetterIndex("R");
const M = getExampleLetterIndex("M");

describe("遊び方の式", () => {
  test("ゴールの盤面の手順を打ち終えると本番の判定で解けていること", () => {
    const solved = goalSteps.reduce(
      (state, { letter, digit }) =>
        placeFukumenzanDigit(state, getExampleLetterIndex(letter), digit),
      createExamplePuzzleState({ placed: {} }),
    );

    expect(isFukumenzanSolved(howToPlayProblem, solved)).toBe(true);
  });
});

describe("findExampleHint", () => {
  describe("押してから押す手の場合", () => {
    const initial = createExamplePuzzleState(tapOperationExample);

    test("触る前は札を示すこと", () => {
      expect(findExampleHint(tapOperationExample, initial, null, null)).toEqual(
        { kind: "card", digit: 8 },
      );
    });

    test("札を選ぶと文字を示すこと", () => {
      expect(
        findExampleHint(
          tapOperationExample,
          initial,
          { kind: "card", digit: 8 },
          null,
        ),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("ほかの札を選ぶと手がかりを消すこと", () => {
      expect(
        findExampleHint(
          tapOperationExample,
          initial,
          { kind: "card", digit: 5 },
          null,
        ),
      ).toBeNull();
    });

    test("札を入れると手がかりを消すこと", () => {
      expect(
        findExampleHint(
          tapOperationExample,
          placeFukumenzanDigit(initial, D, 8),
          null,
          null,
        ),
      ).toBeNull();
    });
  });

  describe("運ぶ手の場合", () => {
    const initial = createExamplePuzzleState(dragOperationExample);

    test("札を押して選んだだけなら札を示したままにすること", () => {
      expect(
        findExampleHint(
          dragOperationExample,
          initial,
          { kind: "card", digit: 8 },
          null,
        ),
      ).toEqual({ kind: "card", digit: 8 });
    });

    test("札を運び始めると落とし先の文字を示すこと", () => {
      expect(
        findExampleHint(dragOperationExample, initial, null, {
          digit: 8,
          fromLetter: null,
          x: 0,
          y: 0,
          overLetter: null,
        }),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("ほかの札を運ぶと手がかりを消すこと", () => {
      expect(
        findExampleHint(dragOperationExample, initial, null, {
          digit: 5,
          fromLetter: null,
          x: 0,
          y: 0,
          overLetter: null,
        }),
      ).toBeNull();
    });
  });

  test("文字から運ぶ手では運び始めた文字の札で落とし先を示すこと", () => {
    expect(
      findExampleHint(
        moveOperationExample,
        createExamplePuzzleState(moveOperationExample),
        null,
        { digit: 8, fromLetter: U, x: 0, y: 0, overLetter: null },
      ),
    ).toEqual({ kind: "letter", letter: "D" });
  });

  test("列へ戻す手では文字を選ぶと空いた場所の札を示すこと", () => {
    expect(
      findExampleHint(
        returnOperationExample,
        createExamplePuzzleState(returnOperationExample),
        { kind: "letter", letter: D },
        null,
      ),
    ).toEqual({ kind: "card", digit: 8 });
  });

  describe("付け外しの手の場合", () => {
    const crossed = toggleFukumenzanCross(
      createExamplePuzzleState(crossOperationExample),
      U,
      5,
    );

    test("× を付けた後も文字を選んでいる間は札を示し続けること", () => {
      expect(
        findExampleHint(
          crossOperationExample,
          crossed,
          { kind: "letter", letter: U },
          null,
        ),
      ).toEqual({ kind: "card", digit: 5 });
    });

    test("× を付けて選びを解くと手がかりを消すこと", () => {
      expect(
        findExampleHint(crossOperationExample, crossed, null, null),
      ).toBeNull();
    });
  });

  test("できない形の例には手がかりを付けないこと", () => {
    const example = leadingZeroRuleExamples[1];

    expect(
      findExampleHint(example, createExamplePuzzleState(example), null, null),
    ).toBeNull();
  });
});

describe("isExampleChanged", () => {
  test("札を入れて戻すと触る前と同じ姿と見ること", () => {
    const initial = createExamplePuzzleState(tapOperationExample);
    const back = returnFukumenzanDigit(placeFukumenzanDigit(initial, D, 8), D);

    expect(isExampleChanged(tapOperationExample, back)).toBe(false);
  });
});

describe("judgeExample", () => {
  describe("先頭の0のルールの場合", () => {
    const [allowed, disallowed] = leadingZeroRuleExamples;
    const initial = createExamplePuzzleState(allowed);

    test("できる形の例は、先頭の文字 D が空なので途中と判定すること", () => {
      expect(judgeExample("leading-zero", initial)).toBe("incomplete");
    });

    test("できる形の例で手がかりの手（D に 8）を打つとできると判定すること", () => {
      expect(
        judgeExample("leading-zero", placeFukumenzanDigit(initial, D, 8)),
      ).toBe("allowed");
    });

    test("できる形の例で D に 0 を入れると本番の知らせと同じくできないと判定すること", () => {
      const state = placeFukumenzanDigit(initial, D, 0);

      expect(listFukumenzanLeadingZeroLetters(howToPlayProblem, state)).toEqual(
        [D],
      );
      expect(judgeExample("leading-zero", state)).toBe("disallowed");
    });

    test("できない形の例はできないと判定すること", () => {
      expect(
        judgeExample("leading-zero", createExamplePuzzleState(disallowed)),
      ).toBe("disallowed");
    });
  });

  describe("足し算のルールの場合", () => {
    const [allowed, disallowed] = sumRuleExamples;
    const initial = createExamplePuzzleState(allowed);
    const solvedTens = placeFukumenzanDigit(initial, R, 9);

    test("合う形の例は、十の位の R が空なので途中と判定すること", () => {
      expect(judgeExample("sum", initial)).toBe("incomplete");
    });

    test("合う形の例で手がかりの手（R に 9）を打つと合うと判定すること", () => {
      expect(judgeExample("sum", solvedTens)).toBe("allowed");
    });

    test("R に 7 を入れると本番の知らせと同じく十の位が合わないと判定すること", () => {
      const state = placeFukumenzanDigit(initial, R, 7);

      expect(
        listFukumenzanMiscalculatedColumns(howToPlayProblem, state),
      ).toEqual([1]);
      expect(judgeExample("sum", state)).toBe("disallowed");
    });

    test("十の位まで合っても、本番が百の位から左に計算違いの印を付けたら合わないと判定すること", () => {
      const state = placeFukumenzanDigit(solvedTens, M, 5);

      expect(
        listFukumenzanMiscalculatedColumns(howToPlayProblem, state),
      ).toEqual([2, 3]);
      expect(judgeExample("sum", state)).toBe("disallowed");
    });

    test("合わない形の例は合わないと判定すること", () => {
      expect(judgeExample("sum", createExamplePuzzleState(disallowed))).toBe(
        "disallowed",
      );
    });
  });
});

describe("describeOtherRuleMark", () => {
  test("先頭の0の例で計算違いの印が出たら、足し算の印のわけを返すこと", () => {
    const state = placeFukumenzanDigit(
      createExamplePuzzleState(sumRuleExamples[1]),
      M,
      1,
    );

    expect(describeOtherRuleMark("leading-zero", state)).toBe(
      "足し算の合わない桁に赤い線が出ています",
    );
  });

  test("足し算の例で先頭の0の印が出たら、先頭の0の印のわけを返すこと", () => {
    const state = placeFukumenzanDigit(
      createExamplePuzzleState(sumRuleExamples[0]),
      M,
      0,
    );

    expect(describeOtherRuleMark("sum", state)).toBe(
      "先頭が0の数のマスが赤くなっています",
    );
  });

  test("ほかのルールの印が無ければ何も返さないこと", () => {
    expect(
      describeOtherRuleMark(
        "leading-zero",
        createExamplePuzzleState(leadingZeroRuleExamples[0]),
      ),
    ).toBeUndefined();
  });
});
