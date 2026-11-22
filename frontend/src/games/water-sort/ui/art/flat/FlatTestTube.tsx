import { FlatGlassBack } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatGlassBack";
import { FlatGlassFront } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatGlassFront";
import { FlatLiquid } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatLiquid";
import { FlatRubberStopper } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatRubberStopper";
import { FlatSealingFuse } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatSealingFuse";
import { FlatTestTubeClamp } from "@/games/water-sort/ui/art/flat/FlatTestTube/FlatTestTubeClamp";
import { flatSceneColorClassName } from "@/games/water-sort/ui/art/flat/flat-scene-colors";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import type { TestTubeProps } from "@/games/water-sort/ui/board/test-tube/test-tube-props";
import { cn } from "@/lib/utils";

export function FlatTestTube({
  contents,
  heldBy,
  stoppered = false,
  stopperRef,
  sealTiming,
  liquidOverlay,
  receivingSameReagent,
}: TestTubeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute inset-0", flatSceneColorClassName)}
    >
      <FlatGlassBack />
      <span className="absolute overflow-hidden" style={LIQUID_BOX_STYLE}>
        <FlatLiquid
          contents={contents}
          receivingSameReagent={receivingSameReagent}
        />
        {liquidOverlay}
        {stoppered && sealTiming && <FlatSealingFuse timing={sealTiming} />}
      </span>
      {stoppered && <FlatRubberStopper elementRef={stopperRef} />}
      <FlatGlassFront />
      {heldBy && <FlatTestTubeClamp side={heldBy} />}
    </span>
  );
}
