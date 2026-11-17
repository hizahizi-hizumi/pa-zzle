import type { CSSProperties } from "react";

import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";
import {
  PARKING_JAM_CELL,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { goalFigure } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";

/** ゴールの盤面を描く範囲の幅と高さを、マスの数で表したもの。 */
const goalViewBox = parkingJamBoardGeometry.getViewBox(
  goalFigure.board,
  "figure",
);
const goalWidthInCells = goalViewBox.width / PARKING_JAM_CELL;
const goalHeightInCells = goalViewBox.height / PARKING_JAM_CELL;

/**
 * 例の盤面のマスの大きさ（`--parking-jam-figure-cell`）。例の車は、ゴールの盤面の車と同じ物に見える大きさにする。
 * 狭い画面では、ゴールの盤面の置き場所（画面の幅から左右の余白 32px を除いた幅と、遊び方の層が渡す盤面の上限
 * `max(100svh - 24rem, 70vw)` の小さい方）に、ゴールの盤面を描く範囲の幅（6 マス）を並べる。ゴールの盤面と同じ式にする。
 * 広い画面では、ゴールの盤面と同じ上限の 64px にする。
 * Tailwind が組み立てた文字列を拾えないので、そのまま書く。6 はテストでゴールの盤面と照らす。
 */
export const parkingJamExampleCellClassName =
  "[--parking-jam-figure-cell:min(calc(min(100vw_-_32px,max(100svh_-_24rem,70vw))/6),64px)] lg:[--parking-jam-figure-cell:64px]";

/** マスの大きさの上限。プレイ画面の PC の盤面のマスと見比べて、遊び方の図が盤面より大きく見えない大きさにする。 */
const FIGURE_CELL_MAX_PX = 64;

/**
 * ゴールの盤面のマスの大きさ。置き場所の幅（狭い画面では遊び方の層が渡す上限も）に描く範囲の幅が、
 * 置き場所の高さから見せ直すボタンの段と遊び方の層が下に置くボタンの段を除いた高さに描く範囲の高さが収まる大きさにする。
 */
export function getParkingJamGoalCellStyle(
  replayRowHeightPx: number,
): CSSProperties {
  return {
    "--parking-jam-figure-cell": `min(calc(min(100cqw, var(--how-to-play-goal-board-max, 100cqw)) / ${goalWidthInCells}), calc(min(var(--how-to-play-goal-board-max, 100cqh), 100cqh - ${replayRowHeightPx}px - var(--how-to-play-goal-below, 0px)) / ${goalHeightInCells}), ${FIGURE_CELL_MAX_PX}px)`,
  } as CSSProperties;
}

/** 盤面を描く範囲の大きさ。マスの大きさの倍数で、描く範囲の縦横の比を保つ。 */
export function getParkingJamFigureBoxStyle(
  board: ParkingJamBoard,
): CSSProperties {
  const { width, height } = parkingJamBoardGeometry.getViewBox(board, "figure");
  return {
    width: `calc(var(--parking-jam-figure-cell) * ${width / PARKING_JAM_CELL})`,
    height: `calc(var(--parking-jam-figure-cell) * ${height / PARKING_JAM_CELL})`,
  };
}

export const _private = { goalWidthInCells };
