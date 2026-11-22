import { POUR_ANIMATION_DURATION_MS } from "@/games/water-sort/ui/board/pour/pour-animation";

/** 注ぐ動きの中で、注ぎ元の口が注ぎ先の口の縁に触れる所（動きの長さに対する割合）。ガラスの触れ合う音もここで鳴らす。 */
export const LAB_POUR_TOUCH_OFFSET = 0.34;

/** そろった注ぎ先にゴム栓を差し込み始める所と、栓が奥まで入る所。栓の鳴る音は入る所で鳴らす。 */
export const LAB_STOPPER_START_OFFSET = 0.76;
export const LAB_STOPPER_SEATED_OFFSET = 0.86;

/** 注ぐ間、試験管を傾ける角度。口が底より下がり、液が口から流れ出る向き。 */
export const LAB_POUR_TILT_DEG = 98;

export function getLabPourDelayMs(offset: number): number {
  return POUR_ANIMATION_DURATION_MS * offset;
}
