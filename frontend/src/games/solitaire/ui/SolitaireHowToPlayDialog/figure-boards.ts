import {
  createSolitaireCard,
  SOLITAIRE_KING_RANK,
  type SolitaireCard,
  type SolitaireSuit,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type {
  SolitaireSource,
  SolitaireTransfer,
} from "@/games/solitaire/puzzle/rules";
import {
  emptySolitaireFoundations,
  type SolitaireColumn,
  type SolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import type { SolitaireBoardLayout } from "@/games/solitaire/ui/board/board-geometry";

/**
 * 遊び方の例の盤面。
 * - `layout`: 並べる山。例が使う山だけにして、スマートフォンの幅の面に札を小さくせずに収める。
 * - `columnCardCapacity`: 列に取る高さ（札の枚数）。手を打った後にいちばん長くなる列が入る枚数にし、触っても面の高さを変えない。
 * - `selectedSource`: 最初から選んでおく置き元。本番でも選べる山にする。
 * - `presses`: 例が見せる手を打ち終えるまでに押す山を、押す順に並べる。押す所の手がかりはこの順に付ける。
 */
export type SolitaireHowToPlayExample = {
  state: SolitaireState;
  layout: SolitaireBoardLayout;
  columnCardCapacity: number;
  selectedSource?: SolitaireSource;
  presses: readonly SolitairePile[];
};

function card(suit: SolitaireSuit, rank: number): SolitaireCard {
  return createSolitaireCard(suit, rank);
}

function createExampleState({
  columns = [],
  stock = [],
  waste = [],
  foundations = emptySolitaireFoundations,
}: {
  columns?: readonly SolitaireColumn[];
  stock?: readonly SolitaireCard[];
  waste?: readonly SolitaireCard[];
  foundations?: Partial<SolitaireFoundations>;
}): SolitaireState {
  return {
    columns,
    stock,
    waste,
    foundations: { ...emptySolitaireFoundations, ...foundations },
  };
}

function column(columnIndex: number): SolitairePile & { pile: "column" } {
  return { pile: "column", columnIndex };
}

function foundation(
  suit: SolitaireSuit,
): SolitairePile & { pile: "foundation" } {
  return { pile: "foundation", suit };
}

const stock = { pile: "stock" } as const satisfies SolitairePile;
const waste = { pile: "waste" } as const satisfies SolitairePile;

function columnsOnly(count: number): SolitaireBoardLayout {
  return {
    topRow: [],
    columns: Array.from({ length: count }, (_, index) => index),
  };
}

/**
 * 列に重ねられる札。左の列の ♥7 を選んでおき、数が1つ大きく色の違う ♠8 にだけ置ける。
 * ほかの列は、数は合うが同じ色の ♦8 と、色は違うが数の合わない ♣9 にする。
 */
export const stackDestinationExample = {
  state: createExampleState({
    columns: [
      [card("hearts", 7)],
      [card("spades", 8)],
      [card("diamonds", 8)],
      [card("clubs", 9)],
    ],
  }),
  layout: columnsOnly(4),
  columnCardCapacity: 2,
  selectedSource: column(0),
  presses: [column(1)],
} as const satisfies SolitaireHowToPlayExample;

/** 並びの動く枚数は置く先で決まる。どちらも左の列の ♠9 ♥8 ♣7 を選んでおき、置く先だけを替える。 */
export const runAmountExamples = [
  {
    state: createExampleState({
      columns: [
        [card("spades", 9), card("hearts", 8), card("clubs", 7)],
        [card("diamonds", 10)],
      ],
    }),
    layout: columnsOnly(2),
    columnCardCapacity: 4,
    selectedSource: column(0),
    presses: [column(1)],
  },
  {
    state: createExampleState({
      columns: [
        [card("spades", 9), card("hearts", 8), card("clubs", 7)],
        [card("clubs", 9)],
      ],
    }),
    layout: columnsOnly(2),
    columnCardCapacity: 4,
    selectedSource: column(0),
    presses: [column(1)],
  },
] as const satisfies readonly [
  SolitaireHowToPlayExample,
  SolitaireHowToPlayExample,
];

/**
 * 空いた列へ置ける並び。K から始まる並びは置け、Q から始まる並びは置けない。
 * 並びの奥に ♣3 を置くのは、いちばん奥が K の列を丸ごと空いた列へ動かす手は、列を入れ替えるだけで打てないため。
 */
export const emptyColumnExamples = [
  {
    state: createExampleState({
      columns: [
        [
          card("clubs", 3),
          card("hearts", SOLITAIRE_KING_RANK),
          card("spades", 12),
        ],
        [],
      ],
    }),
    layout: columnsOnly(2),
    columnCardCapacity: 3,
    selectedSource: column(0),
    presses: [column(1)],
  },
  {
    state: createExampleState({
      columns: [[card("clubs", 3), card("hearts", 12), card("spades", 11)], []],
    }),
    layout: columnsOnly(2),
    columnCardCapacity: 3,
    selectedSource: column(0),
    presses: [column(1)],
  },
] as const satisfies readonly [
  SolitaireHowToPlayExample,
  SolitaireHowToPlayExample,
];

const heartFoundationLayout: SolitaireBoardLayout = {
  topRow: [foundation("hearts")],
  columns: [0],
};

/** 組札へ置ける札。♥ の組札が 3 まで積まれていて、次の ♥4 は置け、数の飛ぶ ♥5 は置けない。 */
export const foundationOrderExamples = [
  {
    state: createExampleState({
      columns: [[card("hearts", 4)]],
      foundations: { hearts: 3 },
    }),
    layout: heartFoundationLayout,
    columnCardCapacity: 1,
    selectedSource: column(0),
    presses: [foundation("hearts")],
  },
  {
    state: createExampleState({
      columns: [[card("hearts", 5)]],
      foundations: { hearts: 3 },
    }),
    layout: heartFoundationLayout,
    columnCardCapacity: 1,
    selectedSource: column(0),
    presses: [foundation("hearts")],
  },
] as const satisfies readonly [
  SolitaireHowToPlayExample,
  SolitaireHowToPlayExample,
];

const spadeFoundationLayout: SolitaireBoardLayout = {
  topRow: [foundation("spades")],
  columns: [0],
};

/** 組札から列へ戻せる札。♠ の組札のいちばん上の ♠5 を選んでおき、色の違う ♥6 には戻せ、同じ色の ♣6 には戻せない。 */
export const foundationReturnExamples = [
  {
    state: createExampleState({
      columns: [[card("hearts", 6)]],
      foundations: { spades: 5 },
    }),
    layout: spadeFoundationLayout,
    columnCardCapacity: 2,
    selectedSource: foundation("spades"),
    presses: [column(0)],
  },
  {
    state: createExampleState({
      columns: [[card("clubs", 6)]],
      foundations: { spades: 5 },
    }),
    layout: spadeFoundationLayout,
    columnCardCapacity: 2,
    selectedSource: foundation("spades"),
    presses: [column(0)],
  },
] as const satisfies readonly [
  SolitaireHowToPlayExample,
  SolitaireHowToPlayExample,
];

const stockLayout: SolitaireBoardLayout = {
  topRow: [stock, waste],
  columns: [0],
};

/**
 * 山札をめくって、捨て札のいちばん上の札を使う。めくった ♠8 が捨て札の ♣5 に重なり、♠8 だけを列の ♦9 へ置ける。
 * 列は山札の下に置き、捨て札から斜めに動かす。
 */
export const stockDrawExample = {
  state: createExampleState({
    columns: [[card("diamonds", 9)]],
    stock: [card("spades", 8), card("hearts", 2)],
    waste: [card("clubs", 5)],
  }),
  layout: stockLayout,
  columnCardCapacity: 2,
  presses: [stock, waste, column(0)],
} as const satisfies SolitaireHowToPlayExample;

/** 空の山札を押して、捨て札を山札へ戻す。 */
export const stockRecycleExample = {
  state: createExampleState({
    waste: [card("clubs", 5), card("spades", 8)],
  }),
  layout: { topRow: [stock, waste], columns: [] },
  columnCardCapacity: 0,
  presses: [stock],
} as const satisfies SolitaireHowToPlayExample;

/** 動かし方。左の列の ♠9 ♥8 を選んで、右の列の ♦10 へ置く。並びの奥の ♣4 は並びにならず、列に残る。 */
export const moveOperationExample = {
  state: createExampleState({
    columns: [
      [card("clubs", 4), card("spades", 9), card("hearts", 8)],
      [card("diamonds", 10)],
    ],
  }),
  layout: columnsOnly(2),
  columnCardCapacity: 3,
  presses: [column(0), column(1)],
} as const satisfies SolitaireHowToPlayExample;

/** 組札の押し方。♥3 を、♥ の組札でなく左端の ♠ の組札を押して置いても、♥ の組札へ置かれる。 */
export const foundationPressExample = {
  state: createExampleState({
    columns: [[card("hearts", 3)]],
    foundations: { hearts: 2 },
  }),
  layout: {
    topRow: solitaireSuits.map(foundation),
    columns: [0],
  },
  columnCardCapacity: 1,
  presses: [column(0), foundation("spades")],
} as const satisfies SolitaireHowToPlayExample;

/** ゴールの盤面の手と、その間の盤面。始まりから Q を4枚、K を4枚の順に組札へ運ぶ。 */
type SolitaireGoalFigure = {
  start: SolitaireState;
  layout: SolitaireBoardLayout;
  columnCardCapacity: number;
  moves: readonly SolitaireTransfer[];
};

const goalColumns: readonly SolitaireColumn[] = [
  [card("spades", 13), card("hearts", 12)],
  [card("hearts", 13), card("spades", 12)],
  [card("clubs", 13), card("diamonds", 12)],
  [card("diamonds", 13), card("clubs", 12)],
];

/** 組札がどれも J まで積まれ、残りの K と Q が4つの列に並んだ盤面から、8枚を組札へ運び切る。 */
export const goalFigure: SolitaireGoalFigure = {
  start: createExampleState({
    columns: goalColumns,
    foundations: { spades: 11, hearts: 11, diamonds: 11, clubs: 11 },
  }),
  layout: {
    topRow: solitaireSuits.map(foundation),
    columns: [0, 1, 2, 3],
  },
  columnCardCapacity: 2,
  moves: [0, 1, 2, 3, 0, 1, 2, 3].map(
    (columnIndex): SolitaireTransfer => ({
      kind: "transfer",
      source: column(columnIndex),
      destination: { pile: "foundation" },
      cardCount: 1,
    }),
  ),
};

/**
 * 取り消した手の流れのコマ。
 * - `selectedSource`: 次の矢印で動かす置き元。本番の選んだ姿で、どこから動かしたかを示す。
 */
export type SolitaireHowToPlayFrame = {
  state: SolitaireState;
  selectedSource?: SolitaireSource;
};

/** 取り消した手の流れ1つ。`steps` はコマの間の操作で、`retractedMoveCount` は本番の数え方で数えた取り消した手。 */
export type SolitaireRetractionFlow = {
  frames: readonly SolitaireHowToPlayFrame[];
  steps: readonly ("move" | "draw" | "undo")[];
  retractedMoveCount: number;
};

export const retractionFlowLayout = stockLayout;

const retractionStart = createExampleState({
  columns: [[card("diamonds", 9)]],
  stock: [card("hearts", 2)],
  waste: [card("spades", 8)],
});

/**
 * 取り消した手の数え方の流れ。どちらも同じ始まりから、捨て札の ♠8 を列へ動かして取り消す流れと、
 * 山札をめくって取り消す流れを並べる。山札を押した手は、取り消しても数えない。
 */
export const retractionFlows: readonly SolitaireRetractionFlow[] = [
  {
    frames: [
      { state: retractionStart, selectedSource: { pile: "waste" } },
      {
        state: createExampleState({
          columns: [[card("diamonds", 9), card("spades", 8)]],
          stock: [card("hearts", 2)],
        }),
      },
      { state: retractionStart },
    ],
    steps: ["move", "undo"],
    retractedMoveCount: 1,
  },
  {
    frames: [
      { state: retractionStart },
      {
        state: createExampleState({
          columns: [[card("diamonds", 9)]],
          waste: [card("spades", 8), card("hearts", 2)],
        }),
      },
      { state: retractionStart },
    ],
    steps: ["draw", "undo"],
    retractedMoveCount: 0,
  },
];
