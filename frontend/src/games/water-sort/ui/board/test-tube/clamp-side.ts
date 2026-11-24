import {
  CLAMP_HANDLE_TIP_POINTS,
  TUBE_VIEW_WIDTH,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 試験管ばさみの柄を出す向き。 */
export type ClampSide = "left" | "right";

type HorizontalExtent = {
  left: number;
  width: number;
};

type HorizontalBounds = {
  left: number;
  right: number;
};

/** 柄の先が、試験管の箱の外へ出る幅（試験管の幅に対する比）。 */
const HANDLE_REACH_RATIO =
  Math.max(...CLAMP_HANDLE_TIP_POINTS.map(([x]) => x)) / TUBE_VIEW_WIDTH - 1;

/**
 * 持った試験管の、試験管ばさみの柄を出す向き。右に出すのを基本にし、柄の先が盤面の入れ物の右の端を越える列では左に出す。
 * 左に出しても越えるなら、右のままにする。
 */
function getHeldClampSide(
  tube: HorizontalExtent,
  area: HorizontalBounds,
): ClampSide {
  const reach = tube.width * HANDLE_REACH_RATIO;
  const rightOverflows = tube.left + tube.width + reach > area.right;
  const leftOverflows = tube.left - reach < area.left;
  return rightOverflows && !leftOverflows ? "left" : "right";
}

/** 盤面に置いた試験管 `bottle` を持ったときの、柄を出す向き。盤面の入れ物 `area` が無ければ右に出す。 */
export function measureHeldClampSide(
  bottle: Element,
  area: Element | null,
): ClampSide {
  if (!area) {
    return "right";
  }
  return getHeldClampSide(
    bottle.getBoundingClientRect(),
    area.getBoundingClientRect(),
  );
}

export const _private = { getHeldClampSide };
