import type { CSSProperties } from "react";

import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import { createBoardView } from "@/games/bridges/ui/board/board-geometry";

/**
 * ゴールの盤面（7×7）の絵の幅を、マス幅を 1 とした値で。盤面の周りの海（片側 0.4 マス）を含む。
 * 下の式は、Tailwind が組み立てた文字列を拾えないので、この値をそのまま書く。
 */
export const BRIDGES_GOAL_VIEW_WIDTH = 7.8;

/**
 * 遊び方の図のマスの大きさ（`--bridges-figure-cell`）。例のマスは、ゴールの盤面のマスと同じ物に見える大きさにする。
 * - 狭い画面: ゴールの盤面は、画面の幅から左右の余白（32px）を除いた幅、遊び方の層が渡す上限
 *   （画面の高さから 24rem を除いた高さか、幅の7割の大きい方）、画面の高さから見せ直すボタンの段（44px）と
 *   チュートリアルのボタンの段（56px）を除いた高さ、のいちばん小さい方に 7.8 マスを並べ、60px までにする。例も同じ式で決める。
 * - 広い画面: ゴールの盤面は、左の列の幅（画面の幅から右の列・間・左右の余白の 752px を除いた幅。中身の格子は 1280px まで）と、
 *   左の列の高さ（画面の高さから帯・タブ・一文・ボタンの段の約 300px を除いた高さ）の小さい方に 7.8 マスを並べ、60px までにする。
 *   例も同じ式で決める。
 */
export const bridgesFigureCellClassName =
  "[--bridges-figure-cell:min(60px,calc((100vw-32px)/7.8),calc(max(calc(100svh-24rem),70vw)/7.8),calc((100svh-100px)/7.8))] lg:[--bridges-figure-cell:min(60px,calc((min(100vw,1280px)-752px)/7.8),calc((100dvh-300px)/7.8))]";

/** ゴールの盤面のマスを 60px までにする。 */
export const BRIDGES_GOAL_CELL_MAX_PX = 60;

/** 図のマスの大きさの倍数で決めた、盤面の絵の幅と高さ。 */
export function getBridgesFigureBoxStyle(board: BridgesBoard): CSSProperties {
  const view = createBoardView(board);
  return {
    width: `calc(var(--bridges-figure-cell) * ${view.width})`,
    height: `calc(var(--bridges-figure-cell) * ${view.height})`,
  };
}
