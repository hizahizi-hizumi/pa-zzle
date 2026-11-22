import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 液の後ろに見えるガラス。一定の不透明度の白い面1つ。 */
export function FlatGlassBack() {
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M4.9 7 V88.2 A13.1 7.4 0 0 0 31.1 88.2 V7 Z"
        className="fill-white/30 dark:fill-white/8"
      />
    </svg>
  );
}
