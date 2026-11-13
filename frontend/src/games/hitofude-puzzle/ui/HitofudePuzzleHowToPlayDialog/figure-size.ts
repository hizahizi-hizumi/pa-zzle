import type { CSSProperties } from "react";

import { getHitofudePuzzleCellPosition } from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 遊び方の図のマスの大きさ（`--hitofude-figure-cell`）。触れる例のマスは、ゴールの盤面のマスと同じ物に見える大きさにする。
 * - 狭い画面: ゴールの盤面は、画面の幅から左右の余白（32px）を除いた幅と、画面の高さから見せ直すボタンの段と
 *   チュートリアルのボタンの段（100px）を除いた高さの小さい方に、8 マスを並べる。例も同じ式で決め、72px までにする。
 * - 広い画面: ゴールの盤面は、左の列の高さ（画面の高さから帯・タブ・一文・ボタンの段の約 300px を除いた高さ）に 8 マスを並べ、
 *   56px までにする（`hitofudePuzzleGoalCellMaxClassName`。左の列の幅でもおよそ 56px に収まる）。例は、ゴールの盤面と横に並んで
 *   見比べられ、640px ほどの広い面に置くので、同じ式の 1.25 倍（70px まで）にする。マスの線と道の太さはマスの大きさに比例するので、
 *   この差ならゴールの盤面のマスと同じ物に見え、狭い画面と同じく例の面の幅に対して盤面が小さく見えない。
 * 採点の流れの押せない図（2×2）は、同じ大きさを上限に、3つのコマと2つの矢印（どの列も、いちばん長い行の「押して」「なぞる」
 * 「待った」「＋1回」の 42px）と間（4 × 8px）が1行に収まらないときだけ、収まる大きさまで小さくする。
 * Tailwind が組み立てた文字列を拾えないので、どの値もそのまま書く。
 */
export const hitofudePuzzleFigureCellClassNames = {
  example:
    "[--hitofude-figure-cell:min(calc((100vw-32px)/8),calc((100svh-100px)/8),72px)] lg:[--hitofude-figure-cell:min(70px,calc((100dvh-300px)/8*1.25))]",
  flowFrame:
    "[--hitofude-figure-cell:min(calc((100vw-32px)/8),calc((100svh-100px)/8),72px,calc((100cqw-116px)/6))] lg:[--hitofude-figure-cell:min(70px,calc((100dvh-300px)/8*1.25),calc((100cqw-116px)/6))]",
} as const;

/** 広い画面で、ゴールの盤面のマスを 56px までにする。例のマスはこの 1.25 倍までにする。 */
export const hitofudePuzzleGoalCellMaxClassName =
  "lg:[--hitofude-goal-cell-max:56px]";

/** マス1つの置き場所。盤面の左上から、図のマスの大きさ（`--hitofude-figure-cell`）の倍数で置く。 */
export function getHitofudePuzzleFigureCellBoxStyle(
  size: number,
  cell: number,
): CSSProperties {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  return {
    left: `calc(var(--hitofude-figure-cell) * ${column})`,
    top: `calc(var(--hitofude-figure-cell) * ${row})`,
    width: "var(--hitofude-figure-cell)",
    height: "var(--hitofude-figure-cell)",
  };
}

/** `size` マス四方の盤面の一辺。 */
export function getHitofudePuzzleFigureSide(size: number): string {
  return `calc(var(--hitofude-figure-cell) * ${size})`;
}
