import { MOTION_EASING } from "@/lib/motion";

/**
 * クリアの演出。行・縦の列・斜めの3段で、それぞれの向きの列のマスを端から光でなぞり、光が列の端に着いたときに合計を弾ませる。
 * 3段の後に、盤全体を一度光らせ、そろえる合計を弾ませて仕上げる。段は盤面の大きさによらず同じ間隔で始まる。
 *
 * マスごとに光の層を2枚持ち、同じ層の光が重ならないように振り分ける（重なると後の光が前の光を途中で消してちらつく）。
 * - 1枚目: 行の段と斜めの段。行の光が消えてから斜めの段が始まる。
 * - 2枚目: 縦の列の段と仕上げ。縦の光が消えてから仕上げが始まる。
 */
/** 3段がそれぞれ始まる間隔と、仕上げが始まる時刻。効果音もこの時刻に合わせて鳴らす。 */
export const MAGIC_SQUARE_CLEAR_STAGE_INTERVAL_MS = 300;
export const MAGIC_SQUARE_CLEAR_FINISH_DELAY_MS = 1_000;
const CLEAR_SWEEP_MS = 180;
const CLEAR_GLINT_MS = 220;
const CLEAR_SUM_POP_MS = 360;
const CLEAR_FINISH_MS = 520;
export const MAGIC_SQUARE_CLEAR_HOLD_MS = 280;
/** 動きを減らす設定と動かせない環境で、そろった盤面を見せてから結果へ進むまでの時間。 */
export const MAGIC_SQUARE_CLEAR_STILL_HOLD_MS = 600;

const glintKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.35 },
  { opacity: 0 },
];
const finishGlintKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.8, offset: 0.3 },
  { opacity: 0 },
];
const sumPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.3)", offset: 0.4 },
  { transform: "scale(1)" },
];
const markFlashKeyframes: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.25, offset: 0.4 },
  { opacity: 1 },
];

type ClearStage = {
  /** マスの光の層。 */
  layer: "first" | "second";
  /** その段でなぞるマスと、列の端から数えた位置。なぞらないマスは `null`。 */
  getSweepPosition: (
    row: number,
    column: number,
    size: number,
  ) => number | null;
  /** その段で弾ませる合計の `data-line-kind`。 */
  lineKind: "row" | "column" | "diagonal";
};

const clearStages: readonly ClearStage[] = [
  { layer: "first", getSweepPosition: (_, column) => column, lineKind: "row" },
  { layer: "second", getSweepPosition: (row) => row, lineKind: "column" },
  {
    layer: "first",
    getSweepPosition: (row, column, size) =>
      row === column || row + column === size - 1 ? row : null,
    lineKind: "diagonal",
  },
];

function readCellPosition(element: HTMLElement): {
  row: number;
  column: number;
} {
  return {
    row: Number(element.dataset.row),
    column: Number(element.dataset.column),
  };
}

/**
 * `frame` の中の印を使って、クリアの演出を始める。
 * - マスの光の層: `[data-clear-glint="first"|"second"]` と、マスの位置の `data-row`・`data-column`
 * - 列の端の合計: `[data-line-kind]`
 * - 斜めの合計へ向かう刻み: `[data-diagonal-mark]`
 * - そろえる合計: `[data-magic-sum]`
 */
export function animateMagicSquareClear(
  frame: HTMLElement,
  size: number,
): Animation[] {
  const sweepStepMs = CLEAR_SWEEP_MS / size;
  const stageAnimations = clearStages.flatMap((stage, stageIndex) => {
    const stageStartMs = stageIndex * MAGIC_SQUARE_CLEAR_STAGE_INTERVAL_MS;
    const glints = Array.from(
      frame.querySelectorAll<HTMLElement>(
        `[data-clear-glint="${stage.layer}"]`,
      ),
    ).flatMap((glint) => {
      const { row, column } = readCellPosition(glint);
      const position = stage.getSweepPosition(row, column, size);
      return position === null
        ? []
        : [
            glint.animate(glintKeyframes, {
              duration: CLEAR_GLINT_MS,
              delay: stageStartMs + position * sweepStepMs,
              easing: MOTION_EASING.standard,
            }),
          ];
    });
    const sumPopDelayMs = stageStartMs + CLEAR_SWEEP_MS;
    const sums = Array.from(
      frame.querySelectorAll<HTMLElement>(
        `[data-line-kind="${stage.lineKind}"]`,
      ),
      (sum) =>
        sum.animate(sumPopKeyframes, {
          duration: CLEAR_SUM_POP_MS,
          delay: sumPopDelayMs,
          easing: MOTION_EASING.celebrate,
        }),
    );
    const marks =
      stage.lineKind === "diagonal"
        ? Array.from(
            frame.querySelectorAll<HTMLElement>("[data-diagonal-mark]"),
            (mark) =>
              mark.animate(markFlashKeyframes, {
                duration: CLEAR_SWEEP_MS + CLEAR_GLINT_MS,
                delay: stageStartMs,
                easing: MOTION_EASING.standard,
              }),
          )
        : [];
    return [...glints, ...sums, ...marks];
  });
  const finishGlints = Array.from(
    frame.querySelectorAll<HTMLElement>('[data-clear-glint="second"]'),
    (glint) =>
      glint.animate(finishGlintKeyframes, {
        duration: CLEAR_FINISH_MS,
        delay: MAGIC_SQUARE_CLEAR_FINISH_DELAY_MS,
        easing: MOTION_EASING.standard,
      }),
  );
  const magicSum = frame.querySelector<HTMLElement>("[data-magic-sum]");
  const magicSumPop = magicSum
    ? [
        magicSum.animate(sumPopKeyframes, {
          duration: CLEAR_FINISH_MS,
          delay: MAGIC_SQUARE_CLEAR_FINISH_DELAY_MS,
          easing: MOTION_EASING.celebrate,
        }),
      ]
    : [];
  return [...stageAnimations, ...finishGlints, ...magicSumPop];
}
