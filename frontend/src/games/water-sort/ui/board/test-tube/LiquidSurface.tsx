import { LIQUID_SURFACE } from "@/games/water-sort/ui/board/test-tube/liquid-surface";

/** 液面。置いた要素の上の端に沿わせる。 */
export function LiquidSurface() {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 top-0">
      <span
        className="block"
        style={{
          height: LIQUID_SURFACE.shadePx,
          backgroundColor: LIQUID_SURFACE.shadeColor,
        }}
      />
      <span
        className="block"
        style={{
          height: LIQUID_SURFACE.highlightPx,
          backgroundColor: LIQUID_SURFACE.highlightColor,
        }}
      />
    </span>
  );
}
