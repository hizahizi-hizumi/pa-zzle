import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

/**
 * 板が島から相手の島へ伸びる時間。架ける木の音（`assets/sounds/bridge-placed.flac` などは鳴り始めが最も強く、90ms ほどで消える）が
 * 鳴っている間に板が渡り切るよう、伸び始めを速くし、音の消えるころに着かせる。
 */
const EXTEND_MS = 120;
/** 外した2枚の板が、相手の島から押した島へ縮んで消える時間。外す音（80ms ほど）に合わせ、架けるより短くする。 */
const RETRACT_MS = 100;

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
 * - 1本・2本になった: 新しく足した板を、`origin`（押した島、または押した所に近い島）から相手の島へ伸ばす。
 * - なしになった: 外した2枚の板を、相手の島から `origin` へ縮めて消す。
 * 動きを減らす設定では動かさない（板はすぐ置かれ、すぐ消える）。
 */
export function playBridgeMotion(
  figure: SVGSVGElement | null,
  edge: number,
  count: BridgeCount,
  origin: BoardPoint,
  horizontal: boolean,
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
  figure
    .querySelector(
      `[${bridgesFigureParts.bridgeEdge}="${edge}"] [${bridgesFigureParts.bridgePlank}="${count - 1}"]`,
    )
    ?.animate?.(
      [
        { transform: collapsed, transformOrigin },
        { transform: "none", transformOrigin },
      ],
      { duration: EXTEND_MS, easing: MOTION_EASING.celebrate },
    );
}
