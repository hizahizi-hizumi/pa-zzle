import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import { prefersReducedMotion } from "@/lib/motion";

/** 阻んだ橋の縁取りの点灯は動かないので、動きを減らす設定でも返す。 */
const OUTLINE_MS = 800;
const outlineKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0, offset: 0.22 },
  { opacity: 1, offset: 0.27 },
  { opacity: 1, offset: 0.6 },
  { opacity: 0 },
];

/**
 * 押した島から伸びて阻んだ橋に突き当たり、弾かれて縮む板。伸び切った所で阻んだ橋に当たり、少し押し戻されてから引っ込む。
 */
const ATTEMPT_MS = 620;
function createAttemptKeyframes(axis: string | null): Keyframe[] {
  const scale = (value: number) =>
    axis === "y" ? `scale(1, ${value})` : `scale(${value}, 1)`;
  return [
    { opacity: 0.9, transform: scale(0) },
    { opacity: 0.9, transform: scale(1), offset: 0.3 },
    { opacity: 0.9, transform: scale(0.82), offset: 0.45 },
    { opacity: 0.9, transform: scale(0.94), offset: 0.58 },
    { opacity: 0, transform: scale(0.4) },
  ];
}
const reducedAttemptKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.8, offset: 0.15 },
  { opacity: 0 },
];

/** 阻んだ橋の板を、板の幅の向きへ短く揺らす時間と、揺れの幅の並び（マス幅を 1 とした値）。板が突き当たったときに揺らす。 */
const SHAKE_MS = 360;
const SHAKE_DELAY_MS = ATTEMPT_MS * 0.3;
const SHAKE_OFFSETS = [0, 0.08, -0.07, 0.05, -0.025, 0] as const;

function createShakeKeyframes(axis: string | null): Keyframe[] {
  return SHAKE_OFFSETS.map((offset) => ({
    transform:
      axis === "y"
        ? `translate(0px, ${offset}px)`
        : `translate(${offset}px, 0px)`,
  }));
}

export function flashBlockingBridges(figure: SVGSVGElement | null): void {
  if (!figure) {
    return;
  }
  const reduced = prefersReducedMotion();
  for (const outline of figure.querySelectorAll(
    `[${bridgesFigureParts.blockingOutline}]`,
  )) {
    outline.animate?.(outlineKeyframes, {
      duration: OUTLINE_MS,
      easing: "ease-out",
    });
    const bridge = outline.closest(`[${bridgesFigureParts.bridgeEdge}]`);
    if (bridge && !reduced) {
      bridge.animate?.(
        createShakeKeyframes(
          bridge.getAttribute(bridgesFigureParts.bridgeAxis),
        ),
        { duration: SHAKE_MS, delay: SHAKE_DELAY_MS, easing: "ease-out" },
      );
    }
  }
  const attempt = figure.querySelector(
    `[${bridgesFigureParts.blockedAttempt}]`,
  );
  attempt?.animate?.(
    reduced
      ? reducedAttemptKeyframes
      : createAttemptKeyframes(attempt.getAttribute("data-axis")),
    { duration: ATTEMPT_MS, easing: "ease-out" },
  );
}
