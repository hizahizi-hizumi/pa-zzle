import type {
  MinesweeperExampleMove,
  MinesweeperHowToPlayFigureRows,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";

/**
 * 入口のゴールの盤面。レベル1の問題集の 9×9・地雷9個の問題と同じ地雷の置き場所で、右下の角から本番と同じに続けて開いた姿から始める。
 */
export const goalFigure = [
  "*.......*",
  "..*..*...",
  ".........",
  "....*....",
  ".......*.",
  "*.....ooo",
  ".....*ooo",
  "...*ooooo",
  "....ooooo",
] as const satisfies MinesweeperHowToPlayFigureRows;

/** 触れる例1つ。`moves` は例が見せる手で、押す所の手がかりをこの順に付ける。 */
export type MinesweeperHowToPlayExample = {
  rows: MinesweeperHowToPlayFigureRows;
  moves: readonly MinesweeperExampleMove[];
};

/**
 * 数字のルールの例。2つの1は閉じた隣が上の段の2マス目だけなのでそこが地雷、左の2は閉じた隣が2つだけなので両方が地雷、
 * 右の2はその2つで数がそろうので、右の2マスは地雷ではない。
 * 右の2マスを開いても、本番と同じく続けて開かない（周りに地雷がある）。
 */
export const numberRuleExample = {
  rows: ["o**.", "ooo."],
  moves: [
    { cellIndex: 3, action: "reveal" },
    { cellIndex: 7, action: "reveal" },
  ],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * 地雷の数のルールの例。右下の1は閉じたマスが真ん中だけなので地雷、上と左の1でその隣の2マスは地雷ではない。
 * 左上の角は数字が届かないので、盤面全体の地雷が1つ（真ん中で使い切る）であることからだけ、地雷ではないと決まる。
 * 手がかりは、このルールで決まる左上の角から付ける。
 */
export const mineCountRuleExample = {
  rows: ["..o", ".*o", "ooo"],
  moves: [
    { cellIndex: 0, action: "reveal" },
    { cellIndex: 1, action: "reveal" },
    { cellIndex: 3, action: "reveal" },
  ],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * 完成のルールの例。地雷を1つ踏み、もう1つの地雷に旗を置いたまま、地雷ではない最後のマスを開くと完成する。
 * 閉じたマスは押すマスだけにし、押す所を迷わせない。旗のマスは押しても開かないので、2つ目の地雷を踏むこともない。
 */
export const completionRuleExample = {
  rows: ["oxF.", "oooo"],
  moves: [{ cellIndex: 3, action: "reveal" }],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * 開き方の例。すべて閉じた盤面の右下を開くと、周りに地雷の無いマスが続けて開き、数字のマスで止まる。上の段は閉じたまま残る。
 */
export const revealOperationExample = {
  rows: ["*.*.", "....", "...."],
  moves: [{ cellIndex: 11, action: "reveal" }],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * まとめて開く例。1の周りの地雷に旗を置いてあるので、1を押すと周りの残りの4マスが開く。右の端は1から離れていて閉じたまま残る。
 */
export const chordOperationExample = {
  rows: [".F.*", ".o.."],
  moves: [{ cellIndex: 5, action: "chord" }],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * 旗の置き方の例。すべて閉じた盤面の上の段の真ん中に旗を置く。
 * 旗を置くマスは地雷ではない数字のマスにし、長押しや切り替えの前に普通に押しても、地雷を踏まずに開くだけにする。
 * 開くと旗はもう置けないので、手がかりは消える（元に戻すと出し直す）。
 */
export const flagOperationExample = {
  rows: ["*..", "..*"],
  moves: [{ cellIndex: 1, action: "flag" }],
} as const satisfies MinesweeperHowToPlayExample;

/**
 * 踏んだ地雷の数え方の流れの、始まりの盤面。2の周りの地雷ではない2マスに、違う旗を置いてある。
 * 左上の地雷を開くと1個、2を押すと旗と同じ数の地雷があるとみなして周りの残りを開き、2個踏む。
 */
export const mistakeCountStart = [
  "*.*",
  "fof",
] as const satisfies MinesweeperHowToPlayFigureRows;

/** 流れの図で押すマス。 */
export const mistakeCountMoves = {
  mine: { cellIndex: 0, action: "reveal" },
  chord: { cellIndex: 4, action: "chord" },
} as const satisfies Record<string, MinesweeperMistakeCountMove>;

/** 踏んだ地雷の数え方の流れで打つ手。地雷を踏みうる、開く手とまとめて開く手だけにする。 */
export type MinesweeperMistakeCountMove = MinesweeperExampleMove & {
  action: "reveal" | "chord";
};
