import type { CSSProperties } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeBoardViewBox } from "@/games/ice-floor-maze/ui/board/board-geometry";

/**
 * 遊び方の図のマスの大きさ（`--ice-floor-maze-figure-cell`）。触れる例のマスは、ゴールの盤面のマスと同じ物に見える大きさにする。
 * ゴールの盤面は 6×6 で、外壁を含めた幅はマス 6.36 個分（外壁の厚さ 0.18 マスの両側）。
 * - 狭い画面: ゴールの盤面は、本文の幅（画面の幅から左右の余白 32px を除いた幅）と、遊び方の層が渡す盤面の大きさの上限
 *   （画面の高さから 24rem を除いた高さか、幅の7割の大きい方）の小さい方に収まる。例も同じ式でマスを決め、64px までにする。
 * - 広い画面: ゴールの盤面は、左の列の高さ（画面の高さから帯・タブ・一文・ボタンの段の約 300px を除いた高さ）に収まり、
 *   マスを 55px までにする（`iceFloorMazeGoalCellMaxClassName`）。例も同じ式でマスを決める。4列の盤面（マス 4.36 個分）の対は、
 *   例の面の内側 608px から対の間 40px を除いた幅に2枚が収まるので、横に並ぶ。
 * スマートフォンでは、4列の盤面の対が面の内側の幅に収まらないので、マスを小さくせずに縦に並べる（並べ方は例の面が決める）。
 * 採点の流れの押せない図（3×3 の3コマ）は、同じ大きさを上限に、3つのコマ（マス 3.36 個分ずつ）と2つの矢印
 * （いちばん長い行の「動けず」「待った」の 3 文字ほどの 42px）と間（4 × 8px）が1行に収まらないときだけ、収まる大きさまで小さくする。
 * Tailwind が組み立てた文字列を拾えないので、どの値もそのまま書く。
 */
export const iceFloorMazeFigureCellClassNames = {
  example:
    "[--ice-floor-maze-figure-cell:min(calc(min(100vw-32px,max(100svh-24rem,70vw))/6.36),64px)] lg:[--ice-floor-maze-figure-cell:min(55px,calc((100dvh-300px)/6.36))]",
  flowFrame:
    "[--ice-floor-maze-figure-cell:min(calc(min(100vw-32px,max(100svh-24rem,70vw))/6.36),64px,calc((100cqw-116px)/10.08))] lg:[--ice-floor-maze-figure-cell:min(55px,calc((100dvh-300px)/6.36),calc((100cqw-116px)/10.08))]",
} as const;

/** 広い画面で、ゴールの盤面のマスを、例のマスと同じ 55px までにする。 */
export const iceFloorMazeGoalCellMaxClassName =
  "lg:[--ice-floor-maze-goal-cell-max:55px]";

/** 外壁を含めた盤面の幅と高さ。図のマスの大きさ（`--ice-floor-maze-figure-cell`）の倍数にする。 */
export function getIceFloorMazeFigureSizeStyle(
  board: Pick<IceFloorMazeBoard, "width" | "height">,
): CSSProperties {
  const { width, height } = getIceFloorMazeBoardViewBox(board);
  return {
    width: `calc(var(--ice-floor-maze-figure-cell) * ${width})`,
    height: `calc(var(--ice-floor-maze-figure-cell) * ${height})`,
  };
}
