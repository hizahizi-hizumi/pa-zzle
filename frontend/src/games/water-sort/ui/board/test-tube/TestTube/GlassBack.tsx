import {
  TUBE_BOTTOM_ARC_TOP,
  TUBE_INNER,
  TUBE_RIM,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const { left, right, bottomDepth } = TUBE_INNER;
const GLASS_BACK_PATH = `M${left} ${TUBE_RIM.bottom} V${TUBE_BOTTOM_ARC_TOP} A${(right - left) / 2} ${bottomDepth} 0 0 0 ${right} ${TUBE_BOTTOM_ARC_TOP} V${TUBE_RIM.bottom} Z`;

/**
 * 液の後ろに見えるガラス。地より少し明るい、不透明な1色の面。
 * 注ぐ試験管がほかの試験管の前を通るとき、後ろの液の色が透けて混ざった色の欠片に見えないよう、透かさない。
 */
export function GlassBack() {
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d={GLASS_BACK_PATH}
        className="fill-[#f3f7f8] dark:fill-[#2e3a3e]"
      />
    </svg>
  );
}
