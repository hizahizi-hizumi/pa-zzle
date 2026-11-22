import { RealClamp } from "@/games/water-sort/ui/art/real/RealTestTube/RealClamp";
import { RealGlassBack } from "@/games/water-sort/ui/art/real/RealTestTube/RealGlassBack";
import {
  type GlowingSlots,
  RealGlassFront,
} from "@/games/water-sort/ui/art/real/RealTestTube/RealGlassFront";
import { RealLiquid } from "@/games/water-sort/ui/art/real/RealTestTube/RealLiquid";
import { RealSealingFuse } from "@/games/water-sort/ui/art/real/RealTestTube/RealSealingFuse";
import { RealStopper } from "@/games/water-sort/ui/art/real/RealTestTube/RealStopper";
import { getRealReagentLook } from "@/games/water-sort/ui/art/real/real-reagent";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import type { TestTubeProps } from "@/games/water-sort/ui/board/test-tube/test-tube-props";

/**
 * 写真のように描く試験管。輪郭の線を引かず、ガラスの壁の屈折・縁のつや・液を透る光で形を見せる。
 * 液を収める箱には transform も filter も掛けない。傾けた液と流れは `position: fixed` で箱の切り抜きから出るため、
 * 箱やその祖先が fixed の基準になると、液が試験管の外へずれる。
 */
export function RealTestTube({
  contents,
  heldBy,
  stoppered = false,
  stopperRef,
  sealTiming,
  liquidOverlay,
  receivingSameReagent,
}: TestTubeProps) {
  const glowingSlots: GlowingSlots[] = getLiquidRuns(contents).filter(
    (run) => getRealReagentLook(run.colorIndex) === "glow",
  );
  return (
    <span aria-hidden="true" className="absolute inset-0">
      <RealGlassBack />
      <span className="absolute overflow-hidden" style={LIQUID_BOX_STYLE}>
        <RealLiquid
          contents={contents}
          receivingSameReagent={receivingSameReagent}
        />
        {liquidOverlay}
        {stoppered && sealTiming && <RealSealingFuse timing={sealTiming} />}
      </span>
      {stoppered && <RealStopper elementRef={stopperRef} />}
      <RealGlassFront stoppered={stoppered} glowingSlots={glowingSlots} />
      {heldBy && <RealClamp side={heldBy} />}
    </span>
  );
}
