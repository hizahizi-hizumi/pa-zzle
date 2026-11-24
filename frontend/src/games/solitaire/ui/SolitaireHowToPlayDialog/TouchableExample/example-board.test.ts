import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import {
  emptyColumnExamples,
  type SolitaireHowToPlayExample,
  stackDestinationExample,
  stockDrawExample,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import {
  createSolitaireExampleBoard,
  getSolitaireExampleHintPile,
  hasExampleBoardChanged,
  hasMovedSinceTry,
  judgeSolitaireExampleColumns,
  pressSolitaireExamplePile,
  type SolitaireExampleBoard,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/example-board";

/** 例の最初の姿から、`piles` を順に押した姿。 */
function pressAll(
  example: SolitaireHowToPlayExample,
  piles: readonly SolitairePile[],
): SolitaireExampleBoard {
  return piles.reduce(
    (board, pile) => pressSolitaireExamplePile(board, pile).board,
    createSolitaireExampleBoard(example),
  );
}

function column(columnIndex: number): SolitairePile {
  return { pile: "column", columnIndex };
}

describe("pressSolitaireExamplePile", () => {
  const board = createSolitaireExampleBoard(stackDestinationExample);

  test("置き元を選んでいて置けない列を押すと、本番と同じく受け付けず、選びを残して押した列を覚えること", () => {
    const { board: next, selection } = pressSolitaireExamplePile(
      board,
      column(2),
    );

    expect(selection.type).toBe("invalid");
    expect(next.selectedSource).toEqual(column(0));
    expect(next.rejectedPile).toEqual(column(2));
  });

  test("置ける列を押すと、手を打って選びを解き、試した手を動かした手として残すこと", () => {
    const { board: next } = pressSolitaireExamplePile(board, column(1));

    expect(next.selectedSource).toBeNull();
    expect(next.lastTransfer).toMatchObject({ cardCount: 1 });
    expect(hasMovedSinceTry(next)).toBe(true);
    expect(hasExampleBoardChanged(next, stackDestinationExample)).toBe(true);
  });

  test("置き元を選ぶのをやめても、最初の盤面から変わったとみなさないこと", () => {
    const { board: next } = pressSolitaireExamplePile(board, column(0));

    expect(next.selectedSource).toBeNull();
    expect(hasExampleBoardChanged(next, stackDestinationExample)).toBe(false);
  });
});

describe("getSolitaireExampleHintPile", () => {
  const drawPath = [
    ["最初の姿", [], { pile: "stock" }],
    ["山札をめくった後", [{ pile: "stock" }], { pile: "waste" }],
    ["捨て札を選んだ後", [{ pile: "stock" }, { pile: "waste" }], column(0)],
    [
      "捨て札の札を列へ置いた後",
      [{ pile: "stock" }, { pile: "waste" }, column(0)],
      null,
    ],
  ] as const;
  const selectedExample = emptyColumnExamples[0];

  test.each(drawPath)(
    "山札の例の%sは、例が見せる手の次に押す山に付けること",
    (_, piles, expected) => {
      const hint = getSolitaireExampleHintPile(
        pressAll(stockDrawExample, piles),
        stockDrawExample,
      );

      expect(hint).toEqual(expected);
    },
  );

  test("置けない山を押した後は付けないこと", () => {
    const hint = getSolitaireExampleHintPile(
      pressAll(stackDestinationExample, [column(3)]),
      stackDestinationExample,
    );

    expect(hint).toBeNull();
  });

  test("最初から選んでいる置き元を選ぶのをやめると、置き元に付け直すこと", () => {
    const hint = getSolitaireExampleHintPile(
      pressAll(selectedExample, [column(0)]),
      selectedExample,
    );

    expect(hint).toEqual(column(0));
  });

  test("選び直すと、弾かれた後でもまた置き先に付けること", () => {
    const hint = getSolitaireExampleHintPile(
      pressAll(stackDestinationExample, [column(3), column(0), column(0)]),
      stackDestinationExample,
    );

    expect(hint).toEqual(column(1));
  });
});

describe("judgeSolitaireExampleColumns", () => {
  test("列に重ねる例の最初の姿は、♠8 に置けて ♦8 は同じ色・♣9 は数違いで置けないこと", () => {
    const verdicts = judgeSolitaireExampleColumns(
      createSolitaireExampleBoard(stackDestinationExample),
      stackDestinationExample.layout.columns,
    );

    expect(verdicts).toEqual([
      null,
      { allowed: true },
      { allowed: false, rejection: "same-color" },
      { allowed: false, rejection: "rank" },
    ]);
  });

  test("空いた列へ Q から始まる並びを置こうとすると、K でないわけを返すこと", () => {
    const verdicts = judgeSolitaireExampleColumns(
      createSolitaireExampleBoard(emptyColumnExamples[1]),
      emptyColumnExamples[1].layout.columns,
    );

    expect(verdicts).toEqual([null, { allowed: false, rejection: "not-king" }]);
  });

  test("置き元を選んでいなければ答えを返さないこと", () => {
    const verdicts = judgeSolitaireExampleColumns(
      pressAll(stackDestinationExample, [column(0)]),
      stackDestinationExample.layout.columns,
    );

    expect(verdicts).toBeNull();
  });
});
