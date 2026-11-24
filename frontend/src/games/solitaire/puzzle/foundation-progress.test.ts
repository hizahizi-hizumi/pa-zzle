import {
  createProblemSeededRandom,
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";
import {
  SOLITAIRE_CARD_COUNT,
  SOLITAIRE_RANK_COUNT,
  type SolitaireCard,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import {
  _private,
  findSolitaireFoundationProgress,
} from "@/games/solitaire/puzzle/foundation-progress";
import {
  applySolitaireMove,
  listSolitaireMoves,
} from "@/games/solitaire/puzzle/rules";
import {
  countSolitaireFoundationCards,
  createSolitaireInitialState,
  type SolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

const { searchSolitaireFoundationCount } = _private;

function toFoundations(counts: readonly number[]): SolitaireFoundations {
  return {
    spades: counts[0]!,
    hearts: counts[1]!,
    diamonds: counts[2]!,
    clubs: counts[3]!,
  };
}

describe("findSolitaireFoundationProgress", () => {
  // 調査コード solitaire_difficulty.py の naive_play（seed の配り方を Random(seed * 17 + 1) で、勝つか詰むまで32回まで）が
  // 詰んだ局面と、同じ局面での foundation_progress_reachable（20万局面まで）の答え。山札と捨て札の札は `pool` にまとめてある。
  const researchCases = [
    {
      seed: 0,
      columns: [
        [51, 24],
        [12, 37, 49, 22, 8, 20, 45, 18, 43, 29, 2],
        [25],
        [38, 50, 36, 48, 34, 46, 32, 5],
        [33, 0, 4, 35, 47],
        [],
        [11, 42, 17, 15, 10, 21, 7, 19, 44, 30, 3, 28, 1],
      ],
      foundations: [0, 2, 2, 3],
      pool: [6, 9, 16, 23, 31],
      expected: "unreachable",
    },
    {
      seed: 9,
      columns: [
        [31, 4, 16, 2, 14],
        [38, 11, 36, 48, 21, 46, 32, 44, 30, 3],
        [51, 24, 10, 22, 47, 33],
        [],
        [25, 37, 20, 45, 18, 43],
        [49, 13, 41, 6, 9, 34, 7, 19, 5, 17, 42, 15],
        [12],
      ],
      foundations: [2, 0, 4, 2],
      pool: [8, 23, 35, 50],
      expected: "unreachable",
    },
    {
      seed: 46,
      columns: [
        [38, 11, 23, 9, 21, 46, 32, 44, 30, 42, 15],
        [12, 24],
        [51, 37, 49, 22, 47, 33, 45, 18],
        [],
        [35, 8, 20, 6, 31, 43, 16],
        [29, 10, 7, 13, 36, 19, 5, 17],
        [25, 50],
      ],
      foundations: [5, 0, 3, 3],
      pool: [14, 34, 48],
      expected: "unreachable",
    },
    {
      seed: 69,
      columns: [
        [25, 50, 23, 9],
        [51, 37, 10, 35, 47, 33, 6, 31, 4],
        [48, 19, 7],
        [8, 1, 0, 5],
        [24, 11, 39, 41],
        [30, 12, 18, 3],
        [21, 45, 32, 34, 40, 49, 22],
      ],
      foundations: [0, 5, 4, 0],
      pool: [2, 20, 36, 38, 42, 43, 44, 46],
      expected: "unreachable",
    },
    {
      seed: 22,
      columns: [
        [51, 37, 49, 22, 8],
        [36, 21, 46, 19, 5, 17, 3, 28],
        [24, 10, 35, 47, 20, 45],
        [26, 29, 30],
        [2, 48, 42, 50, 4],
        [12, 34, 7],
        [32, 25, 23, 31, 18, 33, 43],
      ],
      foundations: [2, 4, 0, 3],
      pool: [6, 9, 11, 27, 38, 44],
      expected: "reachable",
    },
    {
      seed: 55,
      columns: [
        [49, 22, 8, 33, 45, 18, 43, 16, 2, 14],
        [51, 37, 10],
        [25],
        [38, 11, 23, 48, 21, 7, 32, 5, 17, 42, 15],
        [4, 44, 36, 3],
        [35, 6, 13, 28, 31],
        [50, 1, 29],
      ],
      foundations: [1, 0, 2, 3],
      pool: [9, 12, 19, 20, 24, 30, 34, 46, 47],
      expected: "reachable",
    },
    {
      seed: 47,
      columns: [
        [8, 20, 6, 18],
        [15, 23, 48, 34, 7, 32, 5, 17, 42],
        [31, 41],
        [50, 9, 45],
        [40, 43, 33, 47, 12, 24],
        [51, 46, 10, 19, 44],
        [37, 49, 14, 11, 38],
      ],
      foundations: [5, 1, 5, 1],
      pool: [16, 21, 22, 25, 35, 36],
      expected: "reachable",
    },
    {
      seed: 15,
      columns: [
        [51, 37, 10, 35, 47, 33, 45, 18, 4, 16, 41],
        [12, 24, 49, 22, 8],
        [],
        [25, 11, 36, 48, 34, 46, 19, 44, 30, 42],
        [38, 50, 23, 9, 21, 7, 32, 5, 17],
        [40, 20, 31, 43],
        [],
      ],
      foundations: [4, 3, 4, 1],
      pool: [6],
      expected: "reachable",
    },
  ] as const;

  test.each(researchCases)(
    "調査コードが seed $seed の詰みで出した答え $expected と同じ答えを返すこと",
    ({ columns, foundations, pool, expected }) => {
      const progress = findSolitaireFoundationProgress({
        columns,
        stock: pool,
        waste: [],
        foundations: toFoundations(foundations),
      });

      expect(progress).toBe(expected);
    },
  );

  describe("組札から戻して置き直すだけの手が残る局面", () => {
    // 組札は ♠K・♥Q・♦K まで。♣A は ♣2 の下に、♥K は ♣5 の下にあり、空いた列が無いので、どちらの上の札も動かせない。
    // 組札の ♥Q は列の ♣K の上へ戻せるが、戻しても組札は増えない。
    const state: SolitaireState = {
      columns: [
        [39, 40],
        [25, 43],
        [41],
        [42],
        [44],
        [45, 46, 47, 48],
        [49, 50, 51],
      ],
      stock: [],
      waste: [],
      foundations: toFoundations([13, 12, 13, 0]),
    };

    test("組札の札を列へ戻す手は打てること", () => {
      const moves = listSolitaireMoves(state);

      expect(moves).toEqual([
        {
          kind: "transfer",
          source: { pile: "foundation", suit: "hearts" },
          destination: { pile: "column", columnIndex: 6 },
          cardCount: 1,
        },
      ]);
    });

    test("今より多くの札を組札に置けないので unreachable を返すこと", () => {
      const progress = findSolitaireFoundationProgress(state);

      expect(progress).toBe("unreachable");
    });
  });

  describe("クリアした盤面", () => {
    const state: SolitaireState = {
      columns: [[], [], [], [], [], [], []],
      stock: [],
      waste: [],
      foundations: toFoundations([13, 13, 13, 13]),
    };

    test("知らせないよう reachable を返すこと", () => {
      const progress = findSolitaireFoundationProgress(state);

      expect(progress).toBe("reachable");
    });
  });

  describe("調べる局面の数の上限で決まらない局面", () => {
    const researchCase = researchCases[2];
    const state: SolitaireState = {
      columns: researchCase.columns,
      stock: researchCase.pool,
      waste: [],
      foundations: toFoundations(researchCase.foundations),
    };

    test("unknown を返すこと", () => {
      const progress = findSolitaireFoundationProgress(state, 10);

      expect(progress).toBe("unknown");
    });
  });
});

/** 配った盤面から、無作為に手を打ち進めた途中の盤面。置く手があれば多くは置く手を選び、組札・捨て札・空いた列のある盤面を作る。 */
function listRandomWalkStates(
  random: ProblemRandom,
  walkCount: number,
  stepCount: number,
): SolitaireState[] {
  const states: SolitaireState[] = [];
  for (let walk = 0; walk < walkCount; walk += 1) {
    const deck = shuffleProblemValues(
      Array.from({ length: SOLITAIRE_CARD_COUNT }, (_, card) => card),
      random,
    );
    let state = createSolitaireInitialState(
      Array.from({ length: 7 }, (_, index) =>
        deck.slice((index * (index + 1)) / 2, ((index + 1) * (index + 2)) / 2),
      ),
      deck.slice(28),
    );
    for (let step = 0; step < stepCount; step += 1) {
      states.push(state);
      const moves = listSolitaireMoves(state);
      const transfers = moves.filter((move) => move.kind === "transfer");
      const move =
        transfers.length > 0 && random() < 0.8
          ? pickProblemValue(transfers, random)
          : pickProblemValue(moves, random);
      state = applySolitaireMove(state, move)!;
    }
  }
  return states;
}

/**
 * 列に札を無作為に積んだ盤面。組札はマークごとに0〜3枚、山札と捨て札に合わせて0〜6枚を置き、残りを無作為な列へ積む。
 * 列の札は並びになっていなくてよい。
 */
function createRandomScatteredState(random: ProblemRandom): SolitaireState {
  const counts = solitaireSuits.map(() => Math.floor(random() * 4));
  const remaining = shuffleProblemValues(
    Array.from({ length: SOLITAIRE_CARD_COUNT }, (_, card) => card).filter(
      (card) =>
        card % SOLITAIRE_RANK_COUNT >=
        counts[Math.floor(card / SOLITAIRE_RANK_COUNT)]!,
    ),
    random,
  );
  const reserveCount = Math.floor(random() * 7);
  const reserve = remaining.slice(0, reserveCount);
  const stockCount = Math.floor(random() * (reserveCount + 1));
  const columns: SolitaireCard[][] = Array.from({ length: 7 }, () => []);
  for (const card of remaining.slice(reserveCount)) {
    columns[Math.floor(random() * columns.length)]!.push(card);
  }
  return {
    columns,
    stock: reserve.slice(0, stockCount),
    waste: reserve.slice(stockCount),
    foundations: toFoundations(counts),
  };
}

function describeColumnsAndFoundations({
  columns,
  foundations,
}: Pick<SolitaireState, "columns" | "foundations">): string {
  return JSON.stringify([
    columns.map((column) => column.join(",")).sort(),
    solitaireSuits.map((suit) => foundations[suit]),
  ]);
}

/**
 * 山札と捨て札を並びのまま扱って、山札をめくる・戻すを何回か打ってから、山札を押す手でない手を1つ打って行ける局面の、列と組札。
 * めくる・戻すを続けると、山札と捨て札の並びは n + 1 回（n は山札と捨て札の枚数）で元に戻る。
 */
function listOrderedNextColumnsAndFoundations(state: SolitaireState): string[] {
  const turned: SolitaireState[] = [state];
  const cycleLength = state.stock.length + state.waste.length;
  for (let turn = 0; turn < cycleLength; turn += 1) {
    const current = turned.at(-1)!;
    const stockTurn = listSolitaireMoves(current).find(
      (move) => move.kind !== "transfer",
    )!;
    turned.push(applySolitaireMove(current, stockTurn)!);
  }
  return turned.flatMap((current) =>
    listSolitaireMoves(current)
      .filter((move) => move.kind === "transfer")
      .map((move) =>
        describeColumnsAndFoundations(applySolitaireMove(current, move)!),
      ),
  );
}

/** 山札と捨て札を並びのまま扱い、規則の手（めくる・戻すを含む）を1手ずつ打って探す。 */
function searchWithOrderedStock(
  state: SolitaireState,
  targetCount: number,
  maxVisitedStates: number,
): "reached" | "unreachable" | "unknown" {
  if (countSolitaireFoundationCards(state.foundations) >= targetCount) {
    return "reached";
  }
  const seenKeys = new Set<string>();
  const stack = [state];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = JSON.stringify([
      describeColumnsAndFoundations(current),
      current.stock,
      current.waste,
    ]);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    if (seenKeys.size > maxVisitedStates) {
      return "unknown";
    }
    for (const move of listSolitaireMoves(current)) {
      const next = applySolitaireMove(current, move)!;
      if (countSolitaireFoundationCards(next.foundations) >= targetCount) {
        return "reached";
      }
      stack.push(next);
    }
  }
  return "unreachable";
}

describe("listPooledNextStates", () => {
  const states = listRandomWalkStates(
    createProblemSeededRandom("solitaire-pooled-next"),
    20,
    150,
  );

  // 1手ごとに行ける列と組札が同じなので、そこから先に行ける列と組札の全体も、解けるかも、組札を増やせるかも同じになる。
  test("無作為な途中の盤面で、山札を札の集まりとして1手で行ける列と組札が、並びのまま山札を押してから1手で行ける列と組札と同じであること", () => {
    const mismatched = states.filter(
      (state) =>
        JSON.stringify(
          [
            ...new Set(
              _private
                .listPooledNextStates(state)
                .map(describeColumnsAndFoundations),
            ),
          ].sort(),
        ) !==
        JSON.stringify(
          [...new Set(listOrderedNextColumnsAndFoundations(state))].sort(),
        ),
    );

    expect(mismatched).toEqual([]);
  });
});

describe("searchSolitaireFoundationCount", () => {
  const random = createProblemSeededRandom("solitaire-foundation-progress");
  const states = Array.from({ length: 60 }, () =>
    createRandomScatteredState(random),
  );
  const maxVisitedStates = 5_000;
  const goals = [
    ["解けるか", () => SOLITAIRE_CARD_COUNT, ["unreachable"]],
    [
      "組札を増やせるか",
      (state: SolitaireState) =>
        countSolitaireFoundationCards(state.foundations) + 1,
      ["reached", "unreachable"],
    ],
  ] as const;

  test.each(goals)(
    "無作為に積んだ盤面で、山札を札の集まりとして扱っても、並びのまま扱っても、決まった%sの答えが同じであること",
    (_, targetCountOf, expectedOutcomes) => {
      const answers = states.map((state) => {
        const targetCount = targetCountOf(state);
        return {
          pooled: searchSolitaireFoundationCount(
            state,
            targetCount,
            maxVisitedStates,
          ).outcome,
          ordered: searchWithOrderedStock(state, targetCount, maxVisitedStates),
        };
      });
      const determined = answers.filter(
        ({ pooled, ordered }) => pooled !== "unknown" && ordered !== "unknown",
      );

      expect({
        mismatched: determined.filter(
          ({ pooled, ordered }) => pooled !== ordered,
        ),
        outcomes: [...new Set(determined.map(({ pooled }) => pooled))].sort(),
      }).toEqual({ mismatched: [], outcomes: expectedOutcomes });
    },
  );
});
