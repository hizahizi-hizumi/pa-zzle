import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * 阻んだ橋の縁取りの点灯。すぐ点け、目を向けてから読める間を置いてゆっくり消す。次の操作の邪魔にならないよう、0.9秒で消し切る。
 * 動かない点灯なので、動きを減らす設定でも返す。
 */
const OUTLINE_MS = 900;
const outlineKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.06 },
  { opacity: 1, offset: 0.6 },
  { opacity: 0 },
];

/** 押した辺に一瞬だけ見せる、架かるはずだった板の影。 */
const ATTEMPT_MS = 520;
const attemptKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.8, offset: 0.15 },
  { opacity: 0 },
];

/** 阻んだ橋の板を、板の幅の向きへ短く揺らす時間と、揺れの幅の並び（マス幅を 1 とした値）。 */
const SHAKE_MS = 300;
const SHAKE_OFFSETS = [0, 0.05, -0.04, 0.025, 0] as const;

function createShakeKeyframes(axis: string | null): Keyframe[] {
  return SHAKE_OFFSETS.map((offset) => ({
    transform:
      axis === "y"
        ? `translate(0px, ${offset}px)`
        : `translate(${offset}px, 0px)`,
  }));
}

/**
 * 交わる橋に阻まれて架けられなかったことを、盤面だけで返す。文字は出さない。
 * 阻んだ橋の板を規則に合わない色で縁取って短く揺らし、押した辺には架かるはずだった板の影を一瞬だけ見せて、
 * どこを押してどの橋に阻まれたかを形で知らせる。動きを減らす設定では揺らさない。
 */
export function flashBlockingBridges(figure: SVGSVGElement | null): void {
  if (!figure) {
    return;
  }
  for (const outline of figure.querySelectorAll(
    `[${bridgesFigureParts.blockingOutline}]`,
  )) {
    outline.animate?.(outlineKeyframes, {
      duration: OUTLINE_MS,
      easing: "ease-out",
    });
    const bridge = outline.closest(`[${bridgesFigureParts.bridgeEdge}]`);
    if (bridge && !prefersReducedMotion()) {
      bridge.animate?.(
        createShakeKeyframes(
          bridge.getAttribute(bridgesFigureParts.bridgeAxis),
        ),
        { duration: SHAKE_MS, easing: "ease-out" },
      );
    }
  }
  figure
    .querySelector(`[${bridgesFigureParts.blockedAttempt}]`)
    ?.animate?.(attemptKeyframes, { duration: ATTEMPT_MS, easing: "ease-out" });
}
