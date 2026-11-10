import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";
import { BRIDGE_LANDING_MS } from "@/games/bridges/ui/board/bridge-extend";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

/** 外した2枚の板が、相手の島から押した島へ縮んで消える時間。外す音（80ms ほど）に合わせ、架けるより短くする。 */
const RETRACT_MS = 100;
/** 渡っている間の板の影の、着いた後の位置からのずれ（マス幅を 1 とした値）。板が浮いて見える分だけ影を遠くへ落とす。 */
const LIFTED_SHADOW_SHIFT = { x: 0.03, y: 0.07 } as const;

/**
 * 辺の向きに沿って、`origin` を起点に縮めた姿の `transform`。横の辺は横に、縦の辺は縦に縮める。
 * SVG の要素の `transform-box` の初めの値は `view-box` なので、`transform-origin` は絵の座標でそのまま置ける。
 */
function collapsedTransform(horizontal: boolean): string {
  return horizontal ? "scale(0, 1)" : "scale(1, 0)";
}

function toOrigin({ x, y }: BoardPoint): string {
  return `${x}px ${y}px`;
}

/**
 * 橋を回した瞬間の板の動き。
 * - 1本・2本になった: 新しく足した板を、`origin`（押した島、または押した所に近い島）から相手の島へ `extendMs` で伸ばす。
 *   伸びる間は板を浮かせて影を遠くへ落とし、着いたら影を沈めて、置いた手応えにする。
 * - なしになった: 外した2枚の板を、相手の島から `origin` へ縮めて消す。
 * 動きを減らす設定では動かさない（板はすぐ置かれ、すぐ消える）。
 */
export function playBridgeMotion(
  figure: SVGSVGElement | null,
  edge: number,
  count: BridgeCount,
  origin: BoardPoint,
  horizontal: boolean,
  extendMs: number,
): void {
  if (!figure || prefersReducedMotion()) {
    return;
  }
  const transformOrigin = toOrigin(origin);
  const collapsed = collapsedTransform(horizontal);
  if (count === 0) {
    figure
      .querySelector(`[${bridgesFigureParts.retracting}="${edge}"]`)
      ?.animate?.(
        [
          { opacity: 1, transform: "none", transformOrigin },
          { opacity: 1, transform: collapsed, transformOrigin },
        ],
        { duration: RETRACT_MS, easing: MOTION_EASING.exit },
      );
    return;
  }
  const plank = figure.querySelector(
    `[${bridgesFigureParts.bridgeEdge}="${edge}"] [${bridgesFigureParts.bridgePlank}="${count - 1}"]`,
  );
  plank?.animate?.(
    [
      { transform: collapsed, transformOrigin },
      { transform: "none", transformOrigin },
    ],
    { duration: extendMs, easing: MOTION_EASING.enter },
  );
  const lifted = `translate(${LIFTED_SHADOW_SHIFT.x}px, ${LIFTED_SHADOW_SHIFT.y}px)`;
  plank?.querySelector(`[${bridgesFigureParts.plankShadow}]`)?.animate?.(
    [
      { transform: lifted },
      {
        transform: lifted,
        offset: extendMs / (extendMs + BRIDGE_LANDING_MS),
      },
      { transform: "none" },
    ],
    {
      duration: extendMs + BRIDGE_LANDING_MS,
      easing: MOTION_EASING.standard,
    },
  );
}
