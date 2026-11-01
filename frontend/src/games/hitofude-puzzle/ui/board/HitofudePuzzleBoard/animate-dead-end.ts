import { hitofudePuzzleFigureParts } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { prefersReducedMotion } from "@/lib/motion";

/** 先端が行き止まりになった瞬間に、輪を一度だけ膨らませて戻す。指に隠れた先端の変化にも気づけるようにする。 */
const DEAD_END_PULSE_DURATION_MS = 360;
const deadEndPulseKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.3)", offset: 0.35 },
  { transform: "scale(1)" },
];

/** 先端が行き止まりになったことを、先端の輪の膨らみで返す。動きを減らす設定では動かさず、輪の見た目だけで示す。 */
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
