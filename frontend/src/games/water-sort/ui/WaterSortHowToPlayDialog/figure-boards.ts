import type {
  WaterSortMove,
  WaterSortState,
} from "@/games/water-sort/puzzle/state";

/** 色の番号。盤面と同じ並びで、赤・青・緑に見える。 */
const RED = 0;
const BLUE = 1;
const GREEN = 2;

/**
 * 入口のゴールの盤面。始まりの盤面から、`moves` の順に注いでそろえる。
 * 続けて注ぐ2手は同じボトルを動かさず、前の手の注ぐ動きが終わる前に次の手を始めても、動きが重ならない。
 * 色をそろえたボトルを左に並べ、空のボトルを始まりと同じ右の端に残して終える。
 */
export const goalFigure = {
  start: [
    [BLUE, BLUE, GREEN, GREEN],
    [RED, RED, BLUE, BLUE],
    [GREEN, GREEN, RED, RED],
    [],
    [],
  ],
  moves: [
    { sourceBottleIndex: 0, destinationBottleIndex: 3 },
    { sourceBottleIndex: 2, destinationBottleIndex: 4 },
    { sourceBottleIndex: 1, destinationBottleIndex: 0 },
    { sourceBottleIndex: 3, destinationBottleIndex: 2 },
    { sourceBottleIndex: 4, destinationBottleIndex: 1 },
  ],
} as const satisfies { start: WaterSortState; moves: readonly WaterSortMove[] };

/**
 * 触れる例1つ。左のボトルから2本目のボトルへ注ぐ形を見せる。
 * 押す所の手がかりは、最初の形のときに注ぐボトルへ、注ぐボトルを選んだら注ぎ先へ付ける。
 * - `selectedBottleIndex`: 最初から注ぐボトルに選んでおくボトル。本番でも選べるボトルにする。
 */
export type WaterSortHowToPlayExample = {
  bottles: WaterSortState;
  selectedBottleIndex?: number;
};

/** 例が見せる注ぎ。どの例も、左のボトルから2本目のボトルへ注ぐ。 */
export const exampleMove = {
  sourceBottleIndex: 0,
  destinationBottleIndex: 1,
} as const satisfies WaterSortMove;

/**
 * どこに注げるかの例。左のボトルを注ぐボトルに選んでおき、その右に、いちばん上が同じ色でまだ入るボトル・
 * いちばん上が違う色のボトル・空のボトル・同じ色でもいっぱいのボトルの順に、注ぎ先の候補を並べる。
 * いっぱいの候補は、1色でいっぱいのルールと重ならないよう、色の混ざったボトルにする。
 */
export const pourDestinationExample = {
  bottles: [
    [BLUE, RED],
    [GREEN, RED],
    [GREEN, BLUE],
    [],
    [BLUE, GREEN, RED, RED],
  ],
  selectedBottleIndex: 0,
} as const satisfies WaterSortHowToPlayExample;

/** 上に続く同じ色は、入るぶんだけまとめて移る。どちらも上に赤が2つ続き、注ぎ先の空きだけが違う。 */
export const amountRuleExamples = [
  {
    bottles: [[BLUE, RED, RED], []],
  },
  {
    bottles: [
      [BLUE, RED, RED],
      [GREEN, GREEN, RED],
    ],
  },
] as const satisfies readonly WaterSortHowToPlayExample[];

/** 1色でいっぱいのボトルからは注げない。どちらも空のボトルへ注ぐ。 */
export const completeRuleExamples = [
  {
    bottles: [[BLUE, RED, RED, RED], []],
  },
  {
    bottles: [[RED, RED, RED, RED], []],
  },
] as const satisfies readonly WaterSortHowToPlayExample[];

/** どこにも注げないボトルは選べない。2本だけの盤面で、注げるボトルがあるかだけが違う。 */
export const destinationRuleExamples = [
  {
    bottles: [
      [BLUE, RED],
      [GREEN, RED],
    ],
  },
  {
    bottles: [
      [BLUE, RED],
      [GREEN, BLUE],
    ],
  },
] as const satisfies readonly WaterSortHowToPlayExample[];

/** 操作の例。注ぐボトルを選んでから、空のボトルへ注ぐ。 */
export const pourOperationExample = {
  bottles: [[BLUE, RED, RED], []],
} as const satisfies WaterSortHowToPlayExample;

/**
 * 押せない図の1コマ。
 * - `selectedBottleIndex`: 注ぐボトルに選んで持ち上げているボトル。本番の選んだ姿で、次に注ぐ元を示す。
 */
export type WaterSortHowToPlayFrame = {
  bottles: WaterSortState;
  selectedBottleIndex?: number;
};

/**
 * 手戻りに数える流れの、コマの間の操作。
 * - `pour`: `moves` の順に注ぐ。2手以上を1つの矢印にまとめるときは、まとめた手をすべて並べる。
 * - `undo` / `restart`: 待った・盤面を戻す。
 */
export type WaterSortHowToPlayFlowStep =
  | { kind: "pour"; moves: readonly WaterSortMove[] }
  | { kind: "undo" }
  | { kind: "restart" };

/** 手戻りに数える流れ1つ。コマを左から順に並べ、`steps` にコマの間の操作を持つ。 */
export type WaterSortHowToPlayBacktrackFigure = {
  frames: readonly WaterSortHowToPlayFrame[];
  steps: readonly WaterSortHowToPlayFlowStep[];
  backtrackMoveCount: number;
};

/**
 * 手戻りの流れの、始まりの盤面。2つの流れを同じ盤面から始め、操作の違いだけを見比べられるようにする。
 * ボトル2本の盤面には、1手では作れず2手で作れる姿が無いので、3本にする。
 */
const backtrackStart = [
  [BLUE, RED],
  [RED, BLUE],
  [],
] as const satisfies WaterSortState;

/**
 * 注いでから待ったで戻す流れと、2手注いでから盤面を戻す流れ。どちらも同じ始まりの盤面から3つの姿で並べ、
 * 最初のコマで、最初に注ぐ左のボトルを持ち上げて示す。
 * 2手注いだ姿は、始まりの盤面から1手では作れない姿にし、2手注いだことを矢印に添える操作の名前（「2手注ぐ」）で伝える。
 */
export const backtrackFigures = {
  undo: {
    frames: [
      { bottles: backtrackStart, selectedBottleIndex: 0 },
      { bottles: [[BLUE], [RED, BLUE], [RED]] },
      { bottles: backtrackStart },
    ],
    steps: [
      {
        kind: "pour",
        moves: [{ sourceBottleIndex: 0, destinationBottleIndex: 2 }],
      },
      { kind: "undo" },
    ],
    backtrackMoveCount: 1,
  },
  restart: {
    frames: [
      { bottles: backtrackStart, selectedBottleIndex: 0 },
      { bottles: [[BLUE, BLUE], [RED], [RED]] },
      { bottles: backtrackStart },
    ],
    steps: [
      {
        kind: "pour",
        moves: [
          { sourceBottleIndex: 0, destinationBottleIndex: 2 },
          { sourceBottleIndex: 1, destinationBottleIndex: 0 },
        ],
      },
      { kind: "restart" },
    ],
    backtrackMoveCount: 2,
  },
} as const satisfies Record<string, WaterSortHowToPlayBacktrackFigure>;

/** 手詰まりの盤面。いっぱいでないボトルは、どれも上の色が違い、どこにも注げない。 */
export const deadlockFigure = {
  bottles: [
    [RED, RED, GREEN, GREEN],
    [BLUE, GREEN, BLUE, GREEN],
    [BLUE, BLUE],
    [RED, RED],
  ],
} as const satisfies WaterSortHowToPlayFrame;
