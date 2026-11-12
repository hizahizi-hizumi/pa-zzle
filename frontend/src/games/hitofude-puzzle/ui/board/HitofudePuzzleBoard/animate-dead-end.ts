import { hitofudePuzzleFigureParts } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { prefersReducedMotion } from "@/lib/motion";

/** 先端が行き止まりになった瞬間に、色を一度だけ薄くして戻す。指に隠れた先端の変化にも気づけるようにする。 */
const DEAD_END_PULSE_DURATION_MS = 360;
const deadEndPulseKeyframes: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.55, offset: 0.35 },
  { opacity: 1 },
];

/** 先端が行き止まりになったことを、先端の先端の濃淡で返す。動きを減らす設定では動かさず、輪の見た目だけで示す。 */
export function animateDeadEnd(figure: SVGSVGElement | null): void {
  const head = figure?.querySelector(`[${hitofudePuzzleFigureParts.head}]`);
  if (typeof head?.animate !== "function" || prefersReducedMotion()) {
    return;
  }
  head.animate(deadEndPulseKeyframes, {
    duration: DEAD_END_PULSE_DURATION_MS,
    easing: "ease-out",
  });
}
