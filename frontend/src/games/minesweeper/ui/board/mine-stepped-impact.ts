import { prefersReducedMotion } from "@/lib/motion";

/** 踏んだマスを、入力の1フレーム目から白く飛ばし、暗く沈めてから戻す。 */
const steppedCellFlashKeyframes: Keyframe[] = [
  { filter: "brightness(2.4) saturate(0.4)" },
  { filter: "brightness(0.45) saturate(1.4)", offset: 0.25 },
  { filter: "brightness(1) saturate(1)" },
];
const STEPPED_CELL_FLASH_MS = 320;
const STEPPED_CELL_FLASH_EASING = "ease-out";

/** 盤面の横揺れ。最初の振れをいちばん大きくし、1往復半で収める。 */
const boardShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-7px)", offset: 0.15 },
  { transform: "translateX(6px)", offset: 0.38 },
  { transform: "translateX(-3px)", offset: 0.62 },
  { transform: "translateX(1.5px)", offset: 0.84 },
  { transform: "translateX(0)" },
];
const BOARD_SHAKE_MS = 150;
const BOARD_SHAKE_EASING = "linear";

/** 地雷を踏んだ重さを、踏んだマスのフラッシュと盤面全体の短い横揺れで返す。入力は止めない。 */
export function playMineSteppedImpact(
  board: HTMLElement,
  steppedCellIndex: number,
): Animation[] {
  if (prefersReducedMotion()) {
    return [];
  }
  const steppedCell = board.querySelector<HTMLElement>(
    `[data-cell-index="${steppedCellIndex}"]`,
  );
  return [
    steppedCell?.animate?.(steppedCellFlashKeyframes, {
      duration: STEPPED_CELL_FLASH_MS,
      easing: STEPPED_CELL_FLASH_EASING,
    }),
    board.animate?.(boardShakeKeyframes, {
      duration: BOARD_SHAKE_MS,
      easing: BOARD_SHAKE_EASING,
    }),
  ].filter((animation) => animation !== undefined);
}
