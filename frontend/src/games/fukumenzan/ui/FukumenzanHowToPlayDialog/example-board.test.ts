import {
  isFukumenzanSolved,
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type { FukumenzanDigit } from "@/games/fukumenzan/puzzle/state";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import {
  createExamplePuzzleState,
  describeOtherRuleMark,
  describeRuleReason,
  findExampleHint,
  findExampleStep,
  getExampleLetterIndex,
  isExampleChanged,
  judgeExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  crossedCardPlaceOperationExample,
  crossOperationExample,
  crossShownOperationExample,
  goalSteps,
  howToPlayProblem,
  leadingZeroRuleExamples,
  miscalculationLineRuleExample,
  moveOperationExample,
  placeOperationExample,
  returnOperationExample,
  sameLetterRuleExample,
  sumRuleExamples,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

const D = getExampleLetterIndex("D");
const U = getExampleLetterIndex("U");
const R = getExampleLetterIndex("R");
const M = getExampleLetterIndex("M");
const E = getExampleLetterIndex("E");

function dragFrom(digit: FukumenzanDigit, fromLetter: number | null) {
  return { digit, fromLetter, x: 0, y: 0, overLetter: null };
}

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
    const initial = createExamplePuzzleState(placeOperationExample);

    test("触る前は札を示すこと", () => {
      expect(
        findExampleHint(placeOperationExample, initial, null, null),
      ).toEqual({ kind: "card", digit: 8 });
    });

    test("札を選ぶと文字を示すこと", () => {
      expect(
        findExampleHint(
          placeOperationExample,
          initial,
          { kind: "card", digit: 8 },
          null,
        ),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("ほかの札を選ぶと手がかりを消すこと", () => {
      expect(
        findExampleHint(
          placeOperationExample,
          initial,
          { kind: "card", digit: 5 },
          null,
        ),
      ).toBeNull();
    });

    test("札を入れると手がかりを消すこと", () => {
      expect(
        findExampleHint(
          placeOperationExample,
          placeFukumenzanDigit(initial, D, 8),
          null,
          null,
        ),
      ).toBeNull();
    });
  });

  describe("押すか運ぶ手の場合", () => {
    const initial = createExamplePuzzleState(placeOperationExample);

    test("札を運び始めても落とし先の文字を示すこと", () => {
      expect(
        findExampleHint(
          placeOperationExample,
          initial,
          null,
          dragFrom(8, null),
        ),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("ほかの札を運ぶと手がかりを消すこと", () => {
      expect(
        findExampleHint(
          placeOperationExample,
          initial,
          null,
          dragFrom(5, null),
        ),
      ).toBeNull();
    });
  });

  describe("2つの手を順に打つ例（同じ文字のルール）の場合", () => {
    const initial = createExamplePuzzleState(sameLetterRuleExample);
    const placed = placeFukumenzanDigit(initial, D, 8);
    const moved = placeFukumenzanDigit(placed, E, 8);

    test("触る前は1つ目の手の札を示すこと", () => {
      expect(
        findExampleHint(sameLetterRuleExample, initial, null, null),
      ).toEqual({ kind: "card", digit: 8 });
    });

    test("1つ目の手を打つと2つ目の手の運び始める D を示すこと", () => {
      expect(
        findExampleHint(sameLetterRuleExample, placed, null, null),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("D を押して選んだだけなら D を示したままにすること", () => {
      expect(
        findExampleHint(
          sameLetterRuleExample,
          placed,
          { kind: "letter", letter: D },
          null,
        ),
      ).toEqual({ kind: "letter", letter: "D" });
    });

    test("D から運び始めると落とし先の E を示すこと", () => {
      expect(
        findExampleHint(sameLetterRuleExample, placed, null, dragFrom(8, D)),
      ).toEqual({ kind: "letter", letter: "E" });
    });

    test("2つの手を打ち終えると手がかりを消すこと", () => {
      expect(
        findExampleHint(sameLetterRuleExample, moved, null, null),
      ).toBeNull();
    });

    test("打ち終えた手の数を数え、手の道から外れたら数えないこと", () => {
      const offPath = placeFukumenzanDigit(initial, D, 9);

      expect(
        [initial, placed, moved, offPath].map((state) =>
          findExampleStep(sameLetterRuleExample, state, null),
        ),
      ).toEqual([0, 1, 2, null]);
    });
  });

  describe("選んでから選ぶのをやめる例の場合", () => {
    const initial = createExamplePuzzleState(crossShownOperationExample);

    test("触る前は U を示し、U を選ぶと2つ目の手としてもう一度 U を示すこと", () => {
      expect([
        findExampleHint(crossShownOperationExample, initial, null, null),
        findExampleHint(
          crossShownOperationExample,
          initial,
          { kind: "letter", letter: U },
          null,
        ),
      ]).toEqual([
        { kind: "letter", letter: "U" },
        { kind: "letter", letter: "U" },
      ]);
    });

    test("U を選んでいる間を1つ目の手を打った後と数えること", () => {
      expect([
        findExampleStep(crossShownOperationExample, initial, null),
        findExampleStep(crossShownOperationExample, initial, {
          kind: "letter",
          letter: U,
        }),
      ]).toEqual([0, 1]);
    });

    test("ほかの文字を選んだら手がかりを消すこと", () => {
      expect(
        findExampleHint(
          crossShownOperationExample,
          initial,
          { kind: "letter", letter: D },
          null,
        ),
      ).toBeNull();
    });
  });

  describe("選んでから運ぶ例（× を付けた札を入れる）の場合", () => {
    const initial = createExamplePuzzleState(crossedCardPlaceOperationExample);
    const selectedU = { kind: "letter", letter: U } as const;

    test("触る前は U を示し、U を選ぶと × の付いた 8 を示すこと", () => {
      expect([
        findExampleHint(crossedCardPlaceOperationExample, initial, null, null),
        findExampleHint(
          crossedCardPlaceOperationExample,
          initial,
          selectedU,
          null,
        ),
      ]).toEqual([
        { kind: "letter", letter: "U" },
        { kind: "card", digit: 8 },
      ]);
    });

    test("8 を運び始めると U を示し、入れたら手がかりを消すこと", () => {
      expect([
        findExampleHint(
          crossedCardPlaceOperationExample,
          initial,
          selectedU,
          dragFrom(8, null),
        ),
        findExampleHint(
          crossedCardPlaceOperationExample,
          placeFukumenzanDigit(initial, U, 8),
          selectedU,
          null,
        ),
      ]).toEqual([{ kind: "letter", letter: "U" }, null]);
    });
  });

  test("文字から運ぶ手では運び始めた文字の札で落とし先を示すこと", () => {
    expect(
      findExampleHint(
        moveOperationExample,
        createExamplePuzzleState(moveOperationExample),
        null,
        dragFrom(8, U),
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

  test("列へ戻す手では D から運び始めても空いた場所の札を示すこと", () => {
    expect(
      findExampleHint(
        returnOperationExample,
        createExamplePuzzleState(returnOperationExample),
        null,
        dragFrom(8, D),
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
    const initial = createExamplePuzzleState(placeOperationExample);
    const back = returnFukumenzanDigit(placeFukumenzanDigit(initial, D, 8), D);

    expect(isExampleChanged(placeOperationExample, back)).toBe(false);
  });
});

describe("judgeExample", () => {
  describe("先頭の0のルールの場合", () => {
    const [allowed, disallowed] = leadingZeroRuleExamples;
    const initial = createExamplePuzzleState(allowed);

    test("できる形の例は、先頭の文字 M と D が 0 でなく埋まっているのでできると判定すること", () => {
      expect(judgeExample("leading-zero", initial)).toBe("allowed");
    });

    test("できる形の例で手がかりの手（D に 0）を打つと、本番の知らせと同じくできないと判定すること", () => {
      const state = placeFukumenzanDigit(initial, D, 0);

      expect(listFukumenzanLeadingZeroLetters(howToPlayProblem, state)).toEqual(
        [D],
      );
      expect(judgeExample("leading-zero", state)).toBe("disallowed");
    });

    test("先頭の文字 D の札を戻すと途中と判定すること", () => {
      expect(
        judgeExample("leading-zero", returnFukumenzanDigit(initial, D)),
      ).toBe("incomplete");
    });

    test("できない形の例は、できる形の例で手がかりの手を打った後と同じ形であること", () => {
      expect(createExamplePuzzleState(disallowed)).toEqual(
        placeFukumenzanDigit(initial, D, 0),
      );
    });
  });

  describe("足し算のルールの場合", () => {
    const [allowed, disallowed] = sumRuleExamples;
    const initial = createExamplePuzzleState(allowed);

    test("合う形の例は、一の位と十の位が埋まって合うので合うと判定すること", () => {
      expect(judgeExample("sum", initial)).toBe("allowed");
    });

    test("合う形の例で手がかりの手（R に 7）を打つと、本番の知らせと同じく十の位が合わないと判定すること", () => {
      const state = placeFukumenzanDigit(initial, R, 7);

      expect(
        listFukumenzanMiscalculatedColumns(howToPlayProblem, state),
      ).toEqual([1]);
      expect(judgeExample("sum", state)).toBe("disallowed");
    });

    test("十の位の R の札を戻すと途中と判定すること", () => {
      expect(judgeExample("sum", returnFukumenzanDigit(initial, R))).toBe(
        "incomplete",
      );
    });

    test("十の位まで合っても、本番が百の位から左に計算違いの印を付けたら合わないと判定すること", () => {
      const state = placeFukumenzanDigit(initial, M, 5);

      expect(
        listFukumenzanMiscalculatedColumns(howToPlayProblem, state),
      ).toEqual([2, 3]);
      expect(judgeExample("sum", state)).toBe("disallowed");
    });

    test("合わない形の例は、合う形の例で手がかりの手を打った後と同じ形であること", () => {
      expect(createExamplePuzzleState(disallowed)).toEqual(
        placeFukumenzanDigit(initial, R, 7),
      );
    });
  });

  test("できる形の例は、触る前も手がかりの手を打った後も本番の判定で解けていないこと", () => {
    const leadingZero = createExamplePuzzleState(leadingZeroRuleExamples[0]);
    const sum = createExamplePuzzleState(sumRuleExamples[0]);
    const states = [
      leadingZero,
      placeFukumenzanDigit(leadingZero, D, 0),
      sum,
      placeFukumenzanDigit(sum, R, 7),
    ];

    expect(
      states.some((state) => isFukumenzanSolved(howToPlayProblem, state)),
    ).toBe(false);
  });
});

describe("describeRuleReason", () => {
  test("先頭の0のルールでできないと判定したら、いちばん左が0と言うこと", () => {
    expect(
      describeRuleReason(
        "leading-zero",
        createExamplePuzzleState(leadingZeroRuleExamples[1]),
      ),
    ).toBe("いちばん左が0");
  });

  test("足し算のルールで合わないと判定したら、線が出たいちばん右の桁を言うこと", () => {
    expect(
      describeRuleReason("sum", createExamplePuzzleState(sumRuleExamples[1])),
    ).toBe("十の位が合わない");
  });

  test("できると判定した形には何も返さないこと", () => {
    expect(
      describeRuleReason(
        "leading-zero",
        createExamplePuzzleState(leadingZeroRuleExamples[0]),
      ),
    ).toBeUndefined();
  });
});

describe("線の例", () => {
  const initial = createExamplePuzzleState(miscalculationLineRuleExample);

  test("触る前は十の位が合わないが、一の位が空いているので本番が線を引かないこと", () => {
    expect(
      listFukumenzanMiscalculatedColumns(howToPlayProblem, initial),
    ).toEqual([]);
  });

  test("手がかりの手（U に 0）を打つと、本番が十の位に線を引くこと", () => {
    expect(
      listFukumenzanMiscalculatedColumns(
        howToPlayProblem,
        placeFukumenzanDigit(initial, U, 0),
      ),
    ).toEqual([1]);
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
      "いちばん左の0が赤くなっています",
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
