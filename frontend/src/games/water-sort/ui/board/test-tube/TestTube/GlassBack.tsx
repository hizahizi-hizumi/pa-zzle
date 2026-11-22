import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 液の後ろに見える、管の奥側のガラス。 */
export function GlassBack() {
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M4.9 7 V88.2 A13.1 7.4 0 0 0 31.1 88.2 V7 Z"
        className="fill-[rgba(190,222,220,0.16)] dark:fill-[rgba(170,205,215,0.07)]"
      />
      <path
        d="M24 10 V86"
        className="stroke-[rgba(255,255,255,0.22)] dark:stroke-[rgba(220,240,255,0.1)]"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
