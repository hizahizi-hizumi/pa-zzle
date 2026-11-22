import { GlassBack } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassBack";
import { GlassFront } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassFront";
import { Liquid } from "@/games/water-sort/ui/board/test-tube/TestTube/Liquid";
import { LiquidGlow } from "@/games/water-sort/ui/board/test-tube/TestTube/LiquidGlow";
import { RubberStopper } from "@/games/water-sort/ui/board/test-tube/TestTube/RubberStopper";
import { SealingFuse } from "@/games/water-sort/ui/board/test-tube/TestTube/SealingFuse";
import { TestTubeClamp } from "@/games/water-sort/ui/board/test-tube/TestTube/TestTubeClamp";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import type { TestTubeProps } from "@/games/water-sort/ui/board/test-tube/test-tube-props";

export function LabTestTube({
  contents,
  heldBy,
  stoppered = false,
  stopperRef,
  sealTiming,
  liquidOverlay,
  receivingSameReagent,
}: TestTubeProps) {
  return (
    <span aria-hidden="true" className="absolute inset-0">
      <LiquidGlow contents={contents} />
      <GlassBack />
      <span className="absolute overflow-hidden" style={LIQUID_BOX_STYLE}>
        <Liquid
          contents={contents}
          receivingSameReagent={receivingSameReagent}
        />
        {liquidOverlay}
        {stoppered && sealTiming && <SealingFuse timing={sealTiming} />}
      </span>
      {stoppered && <RubberStopper elementRef={stopperRef} />}
      <GlassFront held={heldBy !== undefined} />
      {heldBy && <TestTubeClamp side={heldBy} />}
    </span>
  );
}
