import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";

/**
 * 氷の地の上に、1マスずつ載せて描くマス。氷と盤面の外は地形の地で、岩は隣り合うものをつないだ岩場として、地形の側でまとめて描く。
 * `rubble` は、もろい岩が崩れてできた氷のマスに残す石くずの跡。`sliding-block` はマスではなく、マスの上に載る滑る氷の塊。
 */
export type IceFloorMazeCellFaceKind =
  | Exclude<IceFloorMazeStateCell, "ice" | "outside" | "rock">
  | "rubble"
  | "sliding-block";
