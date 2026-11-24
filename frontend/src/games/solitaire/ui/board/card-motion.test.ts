import { _private as cardPrivate } from "@/games/solitaire/puzzle/card";
import {
  emptySolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import { getSolitaireBoardGeometry } from "@/games/solitaire/ui/board/board-geometry";
import {
  getSolitaireBump,
  getSolitaireCardMotionKey,
  listSolitaireMoveTravels,
} from "@/games/solitaire/ui/board/card-motion";

const { parseSolitaireCard } = cardPrivate;

function parseCards(text: string) {
  return text === ""
    ? []
    : text.split(" ").map((card) => parseSolitaireCard(card)!);
}

function snapshot(state: SolitaireState) {
  return {
    state,
    geometry: getSolitaireBoardGeometry({
      width: 320,
      height: 900,
      columnLengths: state.columns.map((column) => column.length),
    }),
  };
}

// 320px 幅では札は 40×56px、列の間は 4px、列の一番奥の札の上端は 64px、ずらし幅は 16.8px。
const before: SolitaireState = {
  columns: [
    parseCards("5D 9C 8H 7S"),
    parseCards("10H"),
    [],
    parseCards("3C"),
    parseCards("4D"),
    parseCards("6S"),
    parseCards("JD"),
  ],
  stock: parseCards("QS KS"),
  waste: parseCards("AH"),
  foundations: emptySolitaireFoundations,
};

describe("listSolitaireMoveTravels", () => {
  describe("列から列へ並びを動かした場合", () => {
    const after: SolitaireState = {
      ...before,
      columns: [
        parseCards("5D"),
        parseCards("10H 9C 8H 7S"),
        ...before.columns.slice(2),
      ],
    };

    test("動かした札ごとに、置き元の列の位置から置き先の列の位置への組を返すこと", () => {
      const travels = listSolitaireMoveTravels(
        {
          kind: "transfer",
          source: { pile: "column", columnIndex: 0 },
          destination: { pile: "column", columnIndex: 1 },
          cardCount: 3,
        },
        snapshot(before),
        snapshot(after),
      );

      expect(
        travels.map(({ key, from, to }) => [
          key,
          from.left,
          Math.round(from.top * 10) / 10,
          to.left,
          Math.round(to.top * 10) / 10,
        ]),
      ).toEqual([
        [
          getSolitaireCardMotionKey(parseSolitaireCard("9C")!),
          0,
          80.8,
          44,
          80.8,
        ],
        [
          getSolitaireCardMotionKey(parseSolitaireCard("8H")!),
          0,
          97.6,
          44,
          97.6,
        ],
        [
          getSolitaireCardMotionKey(parseSolitaireCard("7S")!),
          0,
          114.4,
          44,
          114.4,
        ],
      ]);
    });
  });

  describe("捨て札を組札へ送った場合", () => {
    const after: SolitaireState = {
      ...before,
      waste: [],
      foundations: { ...emptySolitaireFoundations, hearts: 1 },
    };

    test("捨て札の位置から、札のマークの組札の位置への組を返すこと", () => {
      const travels = listSolitaireMoveTravels(
        {
          kind: "transfer",
          source: { pile: "waste" },
          destination: { pile: "foundation" },
          cardCount: 1,
        },
        snapshot(before),
        snapshot(after),
      );

      expect(travels).toEqual([
        {
          key: getSolitaireCardMotionKey(parseSolitaireCard("AH")!),
          from: { left: 44, top: 0 },
          to: { left: 176, top: 0 },
        },
      ]);
    });
  });

  describe("山札をめくった場合", () => {
    const after: SolitaireState = {
      ...before,
      stock: parseCards("KS"),
      waste: parseCards("AH QS"),
    };

    test("めくった札を、山札の位置から捨て札の位置へ動かすこと", () => {
      const travels = listSolitaireMoveTravels(
        { kind: "draw" },
        snapshot(before),
        snapshot(after),
      );

      expect(travels).toEqual([
        {
          key: getSolitaireCardMotionKey(parseSolitaireCard("QS")!),
          from: { left: 0, top: 0 },
          to: { left: 44, top: 0 },
        },
      ]);
    });
  });

  describe("捨て札を山札へ戻した場合", () => {
    const after: SolitaireState = {
      ...before,
      stock: parseCards("AH"),
      waste: [],
    };

    test("山札の裏の札を、捨て札の位置から山札の位置へ動かすこと", () => {
      const travels = listSolitaireMoveTravels(
        { kind: "recycle" },
        snapshot({ ...before, stock: [] }),
        snapshot(after),
      );

      expect(travels).toEqual([
        { key: "stock", from: { left: 44, top: 0 }, to: { left: 0, top: 0 } },
      ]);
    });
  });
});

describe("getSolitaireBump", () => {
  const cases = [
    [
      "隣の列へは、離れた距離の0.35倍だけ進める",
      { pile: "column", columnIndex: 4 },
      44 * 0.35,
      0,
    ],
    [
      "離れた列へは、札の高さの半分までしか進めない",
      { pile: "column", columnIndex: 6 },
      28,
      0,
    ],
  ] as const;

  test.each(cases)("%sこと", (_, target, dx, dy) => {
    const bump = getSolitaireBump(
      snapshot(before),
      { pile: "column", columnIndex: 3 },
      target,
    );

    expect(bump?.keys).toEqual([
      getSolitaireCardMotionKey(parseSolitaireCard("3C")!),
    ]);
    expect(bump?.dx).toBeCloseTo(dx);
    expect(bump?.dy).toBeCloseTo(dy);
  });

  test("列の置き元は、手前から続く並びの札をまとめて進めること", () => {
    const bump = getSolitaireBump(
      snapshot(before),
      { pile: "column", columnIndex: 0 },
      { pile: "column", columnIndex: 3 },
    );

    expect(bump?.keys).toEqual(
      ["9C", "8H", "7S"].map((card) =>
        getSolitaireCardMotionKey(parseSolitaireCard(card)!),
      ),
    );
  });
});
