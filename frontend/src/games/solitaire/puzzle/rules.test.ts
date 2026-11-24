import {
  createProblemSeededRandom,
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";
import {
  parseSolitaireCard,
  SOLITAIRE_CARD_COUNT,
  type SolitaireCard,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import {
  applySolitaireMove,
  findSolitaireTransfer,
  listSolitaireMoves,
  type SolitaireDestination,
  type SolitaireMove,
  type SolitaireSource,
  type SolitaireTransfer,
} from "@/games/solitaire/puzzle/rules";
import {
  countSolitaireFoundationCards,
  createSolitaireInitialState,
  emptySolitaireFoundations,
  findSolitaireRunStart,
  type SolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

function cards(text: string): SolitaireCard[] {
  return text
    .split(" ")
    .filter(Boolean)
    .map((cardText) => parseSolitaireCard(cardText)!);
}

function createState({
  columns = [],
  stock = "",
  waste = "",
  foundations = {},
}: {
  columns?: readonly string[];
  stock?: string;
  waste?: string;
  foundations?: Partial<SolitaireFoundations>;
}): SolitaireState {
  return {
    columns: Array.from({ length: 7 }, (_, index) =>
      cards(columns[index] ?? ""),
    ),
    stock: cards(stock),
    waste: cards(waste),
    foundations: { ...emptySolitaireFoundations, ...foundations },
  };
}

function column(columnIndex: number): SolitaireSource & SolitaireDestination {
  return { pile: "column", columnIndex };
}

const waste: SolitaireSource = { pile: "waste" };
const toFoundation: SolitaireDestination = { pile: "foundation" };

describe("findSolitaireTransfer", () => {
  const cases: readonly (readonly [
    string,
    number | null,
    SolitaireState,
    SolitaireSource,
    SolitaireDestination,
  ])[] = [
    [
      "並びの途中の札が重なる列へ",
      2,
      createState({ columns: ["10S 9H 8C 7D", "9D"] }),
      column(0),
      column(1),
    ],
    [
      "並びの一番奥の札が重なる列へ",
      2,
      createState({ columns: ["KD 5S 4H", "6D"] }),
      column(0),
      column(1),
    ],
    [
      "並びより奥の札だけが重なる列へ",
      null,
      createState({ columns: ["6C 5S 4H", "7H"] }),
      column(0),
      column(1),
    ],
    [
      "K から始まる並びを空いた列へ",
      2,
      createState({ columns: ["3D KS QH"] }),
      column(0),
      column(2),
    ],
    [
      "K でない札から始まる並びを空いた列へ",
      null,
      createState({ columns: ["3D QS JH"] }),
      column(0),
      column(2),
    ],
    [
      "一番奥から K で始まる列を空いた列へ",
      null,
      createState({ columns: ["KS QH"] }),
      column(0),
      column(2),
    ],
    [
      "列から同じ列へ",
      null,
      createState({ columns: ["9H 8C"] }),
      column(0),
      column(0),
    ],
    [
      "空の列から",
      null,
      createState({ columns: ["", "9H"] }),
      column(0),
      column(1),
    ],
    [
      "列の一番手前の札を、その次の数を待つ組札へ",
      1,
      createState({ columns: ["5C 2H"], foundations: { hearts: 1 } }),
      column(0),
      toFoundation,
    ],
    [
      "列の一番手前の札を、次の数を待っていない組札へ",
      null,
      createState({ columns: ["5C 3H"], foundations: { hearts: 1 } }),
      column(0),
      toFoundation,
    ],
    [
      "捨て札の一番上を、重なる列へ",
      1,
      createState({ columns: ["8S"], waste: "7H 7D" }),
      waste,
      column(0),
    ],
    [
      "捨て札の一番上でない札だけが重なる列へ",
      null,
      createState({ columns: ["8S"], waste: "7D 3C" }),
      waste,
      column(0),
    ],
    [
      "捨て札の K を空いた列へ",
      1,
      createState({ waste: "KH" }),
      waste,
      column(3),
    ],
    [
      "捨て札の A を組札へ",
      1,
      createState({ waste: "AD" }),
      waste,
      toFoundation,
    ],
    [
      "組札の一番上を、重なる列へ",
      1,
      createState({ columns: ["6S"], foundations: { hearts: 5 } }),
      { pile: "foundation", suit: "hearts" },
      column(0),
    ],
    [
      "組札から組札へ",
      null,
      createState({ foundations: { hearts: 5 } }),
      { pile: "foundation", suit: "hearts" },
      toFoundation,
    ],
    [
      "空の組札から",
      null,
      createState({ columns: ["2S"] }),
      { pile: "foundation", suit: "hearts" },
      column(0),
    ],
  ];

  test.each(cases)(
    "%sの手で動かす枚数が %s であること",
    (_, expected, state, source, destination) => {
      const transfer = findSolitaireTransfer(state, source, destination);

      expect(transfer?.cardCount ?? null).toBe(expected);
    },
  );
});

describe("applySolitaireMove", () => {
  describe("山札をめくる手", () => {
    const state = createState({ stock: "3C 4C", waste: "2C" });

    test("山札の先頭の札を捨て札の一番上へ移すこと", () => {
      const next = applySolitaireMove(state, { kind: "draw" });

      expect(next).toMatchObject({ stock: cards("4C"), waste: cards("2C 3C") });
    });
  });

  describe("捨て札を山札へ戻す手", () => {
    const state = createState({ waste: "2C 3C 4C" });

    test("捨て札をめくった順のまま山札へ戻すこと", () => {
      const next = applySolitaireMove(state, { kind: "recycle" });

      expect(next).toMatchObject({ stock: cards("2C 3C 4C"), waste: [] });
    });
  });

  describe("打てない手", () => {
    const cases: readonly (readonly [string, SolitaireState, SolitaireMove])[] =
      [
        [
          "山札が空なのにめくる",
          createState({ waste: "2C" }),
          { kind: "draw" },
        ],
        [
          "山札が残っているのに捨て札を戻す",
          createState({ stock: "3C", waste: "2C" }),
          { kind: "recycle" },
        ],
        ["山札も捨て札も空なのに戻す", createState({}), { kind: "recycle" }],
        [
          "動かす枚数が規則と違う",
          createState({ columns: ["10S 9H 8C 7D", "9D"] }),
          {
            kind: "transfer",
            source: column(0),
            destination: column(1),
            cardCount: 3,
          },
        ],
      ];

    test.each(cases)("%s手は null になること", (_, state, move) => {
      const next = applySolitaireMove(state, move);

      expect(next).toBeNull();
    });
  });

  describe("列から列へ並びを動かす手", () => {
    const state = createState({ columns: ["10S 9H 8C 7D", "9D"] });
    const move: SolitaireTransfer = {
      kind: "transfer",
      source: column(0),
      destination: column(1),
      cardCount: 2,
    };

    test("並びの順のまま置き先の手前へ重ねること", () => {
      const next = applySolitaireMove(state, move);

      expect(next?.columns.slice(0, 2)).toEqual([
        cards("10S 9H"),
        cards("9D 8C 7D"),
      ]);
    });
  });

  describe("組札の札を列へ戻す手", () => {
    const state = createState({
      columns: ["6S"],
      foundations: { hearts: 5 },
    });
    const move: SolitaireTransfer = {
      kind: "transfer",
      source: { pile: "foundation", suit: "hearts" },
      destination: column(0),
      cardCount: 1,
    };

    test("組札が1枚減り、その札が列の手前に重なること", () => {
      const next = applySolitaireMove(state, move);

      expect(next).toMatchObject({
        columns: expect.arrayContaining([cards("6S 5H")]),
        foundations: { hearts: 4 },
      });
    });
  });
});

/**
 * 規則を札ごとに直に当てはめて、打てる手を総当たりで並べる。列のどの札からでも、置き先のどれへでも動かしてみて、
 * 動かす札が赤黒交互・降順に重なり、置き先に重なる（空いた列なら K で、その下に札がある）なら打てる手とする。
 * 組札へは1枚だけ、そのマークの次の数の札を置ける。
 */
function listMovesByBruteForce(state: SolitaireState): string[] {
  const rank = (card: SolitaireCard) => (card % 13) + 1;
  const suitIndex = (card: SolitaireCard) => Math.floor(card / 13);
  const isRed = (card: SolitaireCard) =>
    suitIndex(card) === 1 || suitIndex(card) === 2;
  const sitsOn = (card: SolitaireCard, base: SolitaireCard) =>
    rank(card) === rank(base) - 1 && isRed(card) !== isRed(base);
  const foundationRank = (card: SolitaireCard) =>
    state.foundations[solitaireSuits[suitIndex(card)]!];
  const fitsColumn = (
    card: SolitaireCard,
    destination: readonly SolitaireCard[],
    hasCardBelow: boolean,
  ) =>
    destination.length === 0
      ? rank(card) === 13 && hasCardBelow
      : sitsOn(card, destination.at(-1)!);

  const moves: string[] = [];
  state.columns.forEach((source, sourceIndex) => {
    source.forEach((card, cardIndex) => {
      const moved = source.slice(cardIndex);
      const isSequence = moved.every(
        (above, index) => index === 0 || sitsOn(above, moved[index - 1]!),
      );
      if (!isSequence) {
        return;
      }
      state.columns.forEach((destination, destinationIndex) => {
        if (
          destinationIndex !== sourceIndex &&
          fitsColumn(card, destination, cardIndex > 0)
        ) {
          moves.push(
            `column${sourceIndex}>column${destinationIndex}x${moved.length}`,
          );
        }
      });
      if (moved.length === 1 && foundationRank(card) === rank(card) - 1) {
        moves.push(`column${sourceIndex}>foundationx1`);
      }
    });
  });
  const wasteTop = state.waste.at(-1);
  if (wasteTop !== undefined) {
    state.columns.forEach((destination, destinationIndex) => {
      if (fitsColumn(wasteTop, destination, true)) {
        moves.push(`waste>column${destinationIndex}x1`);
      }
    });
    if (foundationRank(wasteTop) === rank(wasteTop) - 1) {
      moves.push("waste>foundationx1");
    }
  }
  solitaireSuits.forEach((suit, index) => {
    const count = state.foundations[suit];
    if (count === 0) {
      return;
    }
    const top = index * 13 + count - 1;
    state.columns.forEach((destination, destinationIndex) => {
      if (fitsColumn(top, destination, true)) {
        moves.push(`foundation-${suit}>column${destinationIndex}x1`);
      }
    });
  });
  if (state.stock.length > 0) {
    moves.push("draw");
  } else if (state.waste.length > 0) {
    moves.push("recycle");
  }
  return moves.sort();
}

function describeMove(move: SolitaireMove): string {
  if (move.kind !== "transfer") {
    return move.kind;
  }
  const { source, destination, cardCount } = move;
  const sourceText =
    source.pile === "column"
      ? `column${source.columnIndex}`
      : source.pile === "waste"
        ? "waste"
        : `foundation-${source.suit}`;
  const destinationText =
    destination.pile === "column"
      ? `column${destination.columnIndex}`
      : "foundation";
  return `${sourceText}>${destinationText}x${cardCount}`;
}

function dealRandomState(random: ProblemRandom): SolitaireState {
  const deck = shuffleProblemValues(
    Array.from({ length: SOLITAIRE_CARD_COUNT }, (_, card) => card),
    random,
  );
  const columns = Array.from({ length: 7 }, (_, index) =>
    deck.slice((index * (index + 1)) / 2, ((index + 1) * (index + 2)) / 2),
  );
  return createSolitaireInitialState(columns, deck.slice(28));
}

/** 無作為に手を打ち進めた途中の盤面。並びを動かす手・組札へ送る手・組札から戻す手・空いた列が出るよう、毎手打てる手から選ぶ。 */
function listRandomWalkStates(
  seed: string,
  walkCount: number,
  stepCount: number,
): SolitaireState[] {
  const random = createProblemSeededRandom(seed);
  const states: SolitaireState[] = [];
  for (let walk = 0; walk < walkCount; walk += 1) {
    let state = dealRandomState(random);
    for (let step = 0; step < stepCount; step += 1) {
      states.push(state);
      const moves = listSolitaireMoves(state);
      const transfers = moves.filter((move) => move.kind === "transfer");
      // 打てる手から一様に選ぶと山札ばかりめくるので、置く手があれば多くは置く手を選ぶ。
      const move =
        transfers.length > 0 && random() < 0.8
          ? pickProblemValue(transfers, random)
          : pickProblemValue(moves, random);
      state = applySolitaireMove(state, move)!;
    }
  }
  return states;
}

describe("listSolitaireMoves", () => {
  const states = listRandomWalkStates("solitaire-rules", 30, 200);

  test("無作為な途中の盤面で、規則を札ごとに当てはめた総当たりと同じ手を並べること", () => {
    const mismatched = states.filter(
      (state) =>
        JSON.stringify(listSolitaireMoves(state).map(describeMove).sort()) !==
        JSON.stringify(listMovesByBruteForce(state)),
    );

    expect(mismatched).toEqual([]);
  });

  test("総当たりで並べた手が、置き元の山と置き先の山の組ごとに1つ以下であること", () => {
    const ambiguousPairs = states.flatMap((state) => {
      const pairs = listMovesByBruteForce(state).map((move) =>
        move.replace(/x\d+$/, ""),
      );
      return pairs.filter((pair, index) => pairs.indexOf(pair) !== index);
    });

    expect(ambiguousPairs).toEqual([]);
  });

  test("途中の盤面に、並びの途中から動かす手・空いた列へ動かす手・組札から戻す手・捨て札を戻す手が含まれること", () => {
    const kinds = new Set(
      states.flatMap((state) =>
        listSolitaireMoves(state).map((move) => {
          if (move.kind !== "transfer") {
            return move.kind;
          }
          const { source, destination, cardCount } = move;
          if (source.pile === "foundation") {
            return "from-foundation";
          }
          if (destination.pile !== "column" || source.pile !== "column") {
            return "other";
          }
          if (state.columns[destination.columnIndex]!.length === 0) {
            return "to-empty-column";
          }
          const sourceColumn = state.columns[source.columnIndex]!;
          return cardCount <
            sourceColumn.length - findSolitaireRunStart(sourceColumn)
            ? "partial-run"
            : "other";
        }),
      ),
    );

    expect(kinds).toEqual(
      new Set([
        "draw",
        "recycle",
        "from-foundation",
        "to-empty-column",
        "partial-run",
        "other",
      ]),
    );
  });

  test("どの手を打っても、52枚がどこかに1枚ずつあること", () => {
    const brokenStates = states
      .flatMap((state) =>
        listSolitaireMoves(state).map(
          (move) => applySolitaireMove(state, move)!,
        ),
      )
      .filter((next) => {
        const placed = [...next.columns.flat(), ...next.stock, ...next.waste];
        return (
          new Set(placed).size !== placed.length ||
          placed.length + countSolitaireFoundationCards(next.foundations) !==
            SOLITAIRE_CARD_COUNT
        );
      });

    expect(brokenStates).toEqual([]);
  });
});
