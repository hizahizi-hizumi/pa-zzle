import type {
  ParkingJamBoard,
  ParkingJamMove,
} from "@/games/parking-jam/puzzle/board";
import type { ParkingJamMoveBlocker } from "@/games/parking-jam/puzzle/rules";
import { parseParkingJamBoardNotation } from "@/games/parking-jam/ui/board/parking-jam-board-notation";

/**
 * 例が見せる手の打ち方。押す所の手がかりの見せ方を決める。
 * - `swipe`: 車を出す向きへスワイプする。手がかりは車に付け、出す向きを添える。
 * - `tap`: 車を押して両端に矢印を出し、出す向きの矢印を押す。手がかりは車、矢印の順に付ける。
 * どちらの例でも、車を押せば本番と同じく矢印が出て、手がかりは出す向きの矢印へ移る。
 */
export type ParkingJamHowToPlayGesture = "swipe" | "tap";

/** 出られない手で当たる物。進む先に道路が無い（`wall`）・植え込み・ほかの車。 */
export type ParkingJamHowToPlayBlocker = Exclude<
  ParkingJamMoveBlocker["kind"],
  "invalid-direction"
>;

export type ParkingJamHowToPlayExample = {
  board: ParkingJamBoard;
  /** 例が見せる手。押す所の手がかりは、この順に付ける。出られない手を見せるときは、その手を最後に置く。 */
  moves: readonly ParkingJamMove[];
  gesture: ParkingJamHowToPlayGesture;
  /** ルールの例で、車の端に出られるかの印を付けない手。例が教えるルールと別のルールで出られない手の ✕ を混ぜないために使う。 */
  unmarkedMoves?: readonly ParkingJamMove[];
  /** ルールの例が教える、出られないわけ。当たったときに、例が教えるルールそのもののわけか、別のルールのわけかを分ける。 */
  taughtBlocker?: ParkingJamHowToPlayBlocker;
};

/** 入口のゴールの盤面。始まりの盤面と、1台ずつ出していく手。 */
type ParkingJamHowToPlayGoal = {
  board: ParkingJamBoard;
  moves: readonly ParkingJamMove[];
};

/**
 * 前か後ろへのルール。縦向きの車1台が、上にも下にも出られる。
 * 下へ出すと、空いたマスで止まらずに一度で道路まで走り抜けるので、下へ出す手を見せる。
 */
export const straightRuleExample: ParkingJamHowToPlayExample = {
  board: parseParkingJamBoardNotation({
    rows: [".a.", ".a.", "..."],
    roadOpenings: [
      { side: "up", startOffset: 1, length: 1 },
      { side: "down", startOffset: 1, length: 1 },
    ],
  }),
  moves: [{ vehicleId: "a", direction: "down" }],
  gesture: "swipe",
};

/**
 * 道路のルール。右の辺にも道路はあるが、車の車線ではなく隣の車線にあるので、右へは出られない。
 * 同じ辺の隣の車線の道路を、出られそうに見えて出られない読み違いとして見せる（PZL-007）。
 * ルールの肝は出られない手なので、手がかりで右へ出す手を試させる。
 */
export const roadRuleExample: ParkingJamHowToPlayExample = {
  taughtBlocker: "wall",
  board: parseParkingJamBoardNotation({
    rows: ["aa..", "...."],
    roadOpenings: [
      { side: "left", startOffset: 0, length: 1 },
      { side: "right", startOffset: 1, length: 1 },
    ],
  }),
  moves: [{ vehicleId: "a", direction: "right" }],
  gesture: "swipe",
};

/** 植え込みのルール。右は同じ車線に道路があるが、手前の植え込みに当たる。植え込みとの間に1マス空け、車の端の札を植え込みに重ねない。手がかりで右へ出す手を試させる。 */
export const planterRuleExample: ParkingJamHowToPlayExample = {
  taughtBlocker: "fixed-area",
  board: parseParkingJamBoardNotation({
    rows: ["aa.#", "...."],
    roadOpenings: [
      { side: "left", startOffset: 0, length: 1 },
      { side: "right", startOffset: 0, length: 1 },
    ],
  }),
  moves: [{ vehicleId: "a", direction: "right" }],
  gesture: "swipe",
};

/**
 * ほかの車のルール。2マスの車は、右を3マスの車に塞がれ、左には道路がない。
 * 3マスの車を先に出すと、2マスの車が右へ出られるようになる。3マスの車も同じルールで出られることを、ここで見せる。
 * 2マスの車の左は道路のルールで出られないので、印を付けない。2マスの車と3マスの車の間に1マス空け、車の端の札を3マスの車に重ねない。
 */
export const carRuleExample: ParkingJamHowToPlayExample = {
  taughtBlocker: "vehicle",
  board: parseParkingJamBoardNotation({
    rows: ["...b", "aa.b", "...b"],
    roadOpenings: [
      { side: "up", startOffset: 3, length: 1 },
      { side: "right", startOffset: 1, length: 1 },
      { side: "down", startOffset: 3, length: 1 },
    ],
  }),
  moves: [
    { vehicleId: "b", direction: "up" },
    { vehicleId: "a", direction: "right" },
  ],
  gesture: "swipe",
  unmarkedMoves: [{ vehicleId: "a", direction: "left" }],
};

/** スワイプで出す操作の例。左右どちらにも道路がある。 */
export const swipeOperationExample: ParkingJamHowToPlayExample = {
  board: parseParkingJamBoardNotation({
    rows: ["aa.", "..."],
    roadOpenings: [
      { side: "left", startOffset: 0, length: 1 },
      { side: "right", startOffset: 0, length: 1 },
    ],
  }),
  moves: [{ vehicleId: "a", direction: "right" }],
  gesture: "swipe",
};

/** 車を押して矢印で出す操作の例。上下どちらにも道路がある。 */
export const tapOperationExample: ParkingJamHowToPlayExample = {
  board: parseParkingJamBoardNotation({
    rows: ["...", ".a.", ".a."],
    roadOpenings: [
      { side: "up", startOffset: 1, length: 1 },
      { side: "down", startOffset: 1, length: 1 },
    ],
  }),
  moves: [{ vehicleId: "a", direction: "up" }],
  gesture: "tap",
};

/**
 * ゴールの盤面。3マスの車 `b` を右へ出すと `c` が上へ出られ、`c` と `e` が出ると `d` が右へ、`d` が出ると `a` が下へ出られる。
 * 植え込みは最後まで残り、動かない物として見える。
 *
 * ```text
 *      上の道路: 2〜3列
 *      1 2 3 4 5
 *   1  a b b b .   右の道路: 1行
 *   2  a . c # .
 *   3  d d c e e   右の道路: 3〜4行
 *   4  . . . f f
 *      下の道路: 1〜2列
 * ```
 */
export const goalFigure: ParkingJamHowToPlayGoal = {
  board: parseParkingJamBoardNotation({
    rows: ["abbb.", "a.c#.", "ddcee", "...ff"],
    roadOpenings: [
      { side: "up", startOffset: 1, length: 2 },
      { side: "right", startOffset: 0, length: 1 },
      { side: "right", startOffset: 2, length: 2 },
      { side: "down", startOffset: 0, length: 2 },
    ],
  }),
  moves: [
    { vehicleId: "b", direction: "right" },
    { vehicleId: "c", direction: "up" },
    { vehicleId: "e", direction: "right" },
    { vehicleId: "d", direction: "right" },
    { vehicleId: "a", direction: "down" },
    { vehicleId: "f", direction: "right" },
  ],
};
