import {
  type HitofudePuzzleBoard,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 触れる例1つ。盤面と、触る前の道と、例が見せる手（押す所を順に）。どの例も、本番の指の操作とまったく同じに動く。
 * - `path`: 始点から先端までに通ったマス。先頭は始点。
 * - `hints`: 例が見せる手を、打つ順に並べる。触る前の道から順に、本番と同じく打っていく
 *   （道のマスを押すとそこまで戻り、離れたマスや穴を押すと弾かれる）。手を見せない例は空。
 * - `visibleColumns`: 盤面の左から何列を見せるか。見せない右の列は、どれも穴にする。渡さなければ全部の列を見せる。
 */
export type HitofudePuzzleHowToPlayExample = {
  board: HitofudePuzzleBoard;
  path: readonly number[];
  hints: readonly HitofudePuzzleHowToPlayHint[];
  visibleColumns?: number;
};

/**
 * 例が見せる手1つ。押す所の手がかりを付けるマスで表す。
 * - マスの番号: そのマスを押すか、先端からなぞって打つ。
 * - `{ traceTo }`: 先端からそのマスへなぞって打つ。押しても同じ道になる手（来た道のマスへ戻るなど）を、
 *   なぞる手として見せるときに使い、押して打ったときは手を進めない。
 */
export type HitofudePuzzleHowToPlayHint = number | { traceTo: number };

/** 手がかりを付けるマス。 */
export function getHitofudePuzzleHowToPlayHintCell(
  hint: HitofudePuzzleHowToPlayHint,
): number {
  return typeof hint === "number" ? hint : hint.traceTo;
}

/** ルールの例の対。左にできる形、右にできない形。 */
export type HitofudePuzzleHowToPlayExamplePair = readonly [
  HitofudePuzzleHowToPlayExample,
  HitofudePuzzleHowToPlayExample,
];

/**
 * 図のマス番号（3×3）
 * 0 1 2
 * 3 4 5
 * 6 7 8
 */
const openBoard = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);

/**
 * ゴールの盤面。8×8 に内側の穴と縁の欠けがあり、始点から全マスを通る道はこの1本だけ。
 * 狭い画面の幅いっぱいに描き、例のマスもこの盤面のマスと同じ物に見える大きさにする（`figure-size.ts`）。
 */
export const goalFigure = {
  board: parseHitofudePuzzleBoard([
    ". . . . . . . .",
    ". # . . . . # .",
    ". . . . . . . .",
    ". . . . . . # #",
    "S . . . # . . .",
    ". . # . . . . .",
    "# . . . . . . .",
    ". . . . # . . .",
  ]),
  solution: [
    32, 40, 41, 33, 34, 26, 18, 17, 25, 24, 16, 8, 0, 1, 2, 10, 11, 3, 4, 12,
    13, 5, 6, 7, 15, 23, 22, 21, 29, 28, 20, 19, 27, 35, 43, 44, 45, 37, 38, 39,
    47, 46, 54, 55, 63, 62, 61, 53, 52, 51, 59, 58, 50, 49, 57, 56,
  ],
} as const satisfies {
  board: HitofudePuzzleBoard;
  solution: readonly number[];
};

/**
 * 同じマスは2回通れない。左下の始点から下の行を右へまっすぐ通り、右の列を上がって、真ん中に先端があり、右から来ている。
 * 先端の下は道がまっすぐ通り抜けたマス（通れない）で、曲がり角でないので、道がもう通ったマスだとひと目で分かる。
 * 先端の上と左はまだ空いたマス（通れる）。1つの盤面で、3つの候補のマスに通れるかの印を付ける。
 * 手がかりは左の通れるマスに付ける。延ばした後も、左の列の始点が通ったマスとして隣に残り、印を付け直して見比べられる。
 * 通ったマスは、本番では押すとそこまで戻るだけで弾かれないので、手がかりを付けない。
 * 通れるマスへ延ばしても、上の行の3マスが残って完成も行き止まりもしない。
 *
 * ```text
 * . . .
 * . . .
 * S . .
 * ```
 */
export const onceRuleExample: HitofudePuzzleHowToPlayExample = {
  board: parseHitofudePuzzleBoard([". . .", ". . .", "S . ."]),
  path: [6, 7, 8, 5, 4],
  hints: [3],
};

/**
 * 穴は通れない。真ん中に内側の穴がある盤面で、下の縁の真ん中に先端があり、右から来ている。
 * 先端の上は穴（通れない）、左はまだ空いたマス（通れる）で、下は盤面の端。
 * 穴は本番でも押すと×で弾かれるので、手がかりを穴に付ける。
 * 3×3 の盤面で縁の欠けでない内側の穴を置けるのは真ん中だけなので、同じマスのルールの例と同じ並び（先端が真ん中）にはしない。
 */
export const holeRuleExample: HitofudePuzzleHowToPlayExample = {
  board: parseHitofudePuzzleBoard(["S . .", ". # .", ". . ."]),
  path: [0, 1, 2, 5, 8, 7],
  hints: [4],
};

/**
 * すべてのマスを通れば完成。2列3行で右下の角が欠けた盤面（3×3 の右の列を穴にして、左の2列だけを見せる）。
 * 狭い画面でもマスを小さくせずに2つを横に並べられるよう、盤面を短くする。
 * できる形はすべてのマスを通って完成した姿、できない形は右上へ抜けて行き止まりになり、左下の1マスを残した姿。
 * どちらも触る前は動かさない。
 *
 * ```text
 * 0 1 #
 * 3 S #
 * 6 # #
 * ```
 */
const shortNotchedBoard = parseHitofudePuzzleBoard([". . #", ". S #", ". # #"]);

export const allCellsRuleExamples: HitofudePuzzleHowToPlayExamplePair = [
  {
    board: shortNotchedBoard,
    path: [4, 1, 0, 3, 6],
    hints: [],
    visibleColumns: 2,
  },
  {
    board: shortNotchedBoard,
    path: [4, 3, 0, 1],
    hints: [],
    visibleColumns: 2,
  },
];

/**
 * 道の延ばし方と縮め方。真ん中の始点から、手がかりを順になぞって3マス延ばし、来た道を1マスなぞって戻ると縮む。
 * 文が言う2つの手（延ばす・なぞって戻る）を、手がかりで順に試せるようにする。
 * 来た道のマスを押しても同じ道に縮むが、押して縮めるのは次の操作の例の手なので、戻る手はなぞったときだけ進める。
 */
export const extendOperationExample: HitofudePuzzleHowToPlayExample = {
  board: parseHitofudePuzzleBoard([". . .", ". S .", ". . ."]),
  path: [4],
  hints: [1, 0, 3, { traceTo: 0 }],
};

/**
 * 道の途中のマスを押して縮め、そこから引き直す。道の途中のマスを押すとそこまで縮み、手がかりを順になぞると、
 * 前と違う道を引いてすべてのマスを通り、完成する。文が言う2つの手（押して縮める・なぞって引き直す）を順に試せるようにする。
 */
export const rewindOperationExample: HitofudePuzzleHowToPlayExample = {
  board: openBoard,
  path: [0, 1, 2, 5, 4, 3],
  hints: [1, 4, 3, 6, 7, 8, 5, 2],
};

/**
 * 図のマス番号（2×2）
 * 0 1
 * 2 3
 */
const backtrackBoard = parseHitofudePuzzleBoard(["S .", ". ."]);

/**
 * 引き直しの数え方の流れを進める操作。
 * - `press`: マスを押して離す（道のマスならそこまで戻る）。
 * - `trace`: 先端から、並べたマスを順になぞって離す。
 * - `pressAndTrace`: マスを押したまま、並べたマスを順になぞって離す。
 * - `undo`: 待った。
 */
export type HitofudePuzzleHowToPlayFlowStep =
  | { kind: "press"; cell: number }
  | { kind: "trace"; cells: readonly number[] }
  | { kind: "pressAndTrace"; cell: number; cells: readonly number[] }
  | { kind: "undo" };

/** 引き直しの数え方の流れ1つ。どの流れも同じ道から始め、`steps` を順に打った後の道をコマに並べる。 */
export type HitofudePuzzleHowToPlayBacktrackFlow = {
  board: HitofudePuzzleBoard;
  start: readonly number[];
  steps: readonly HitofudePuzzleHowToPlayFlowStep[];
};

const backtrackStart = [0, 1, 3];

/**
 * 引き直しに数えない流れと数える流れ。どれも同じ道（始点から右、下）から始める。
 * - `same`: 道の途中を押して戻してから、前と同じマスへなぞる。
 * - `different`: 始点まで戻してから、前と違うマスへなぞる。
 * - `undo`: 始点を押したまま前と違うマスへなぞってから、待ったで元の道へ戻す。
 */
export const backtrackFlows = {
  same: {
    board: backtrackBoard,
    start: backtrackStart,
    steps: [
      { kind: "press", cell: 1 },
      { kind: "trace", cells: [3] },
    ],
  },
  different: {
    board: backtrackBoard,
    start: backtrackStart,
    steps: [
      { kind: "press", cell: 0 },
      { kind: "trace", cells: [2] },
    ],
  },
  undo: {
    board: backtrackBoard,
    start: backtrackStart,
    steps: [{ kind: "pressAndTrace", cell: 0, cells: [2] }, { kind: "undo" }],
  },
} as const satisfies Record<string, HitofudePuzzleHowToPlayBacktrackFlow>;
