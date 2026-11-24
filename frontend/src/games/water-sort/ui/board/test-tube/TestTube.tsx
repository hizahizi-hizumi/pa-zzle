import type { ReactNode, Ref, RefObject } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import type { ClampSide } from "@/games/water-sort/ui/board/test-tube/clamp-side";
import type { TestTubeSealTiming } from "@/games/water-sort/ui/board/test-tube/seal-timing";
import { GlassBack } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassBack";
import { GlassFront } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassFront";
import { Liquid } from "@/games/water-sort/ui/board/test-tube/TestTube/Liquid";
import { RubberStopper } from "@/games/water-sort/ui/board/test-tube/TestTube/RubberStopper";
import { SealingFuse } from "@/games/water-sort/ui/board/test-tube/TestTube/SealingFuse";
import { TestTubeClamp } from "@/games/water-sort/ui/board/test-tube/TestTube/TestTubeClamp";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type TestTubeProps = {
  contents: WaterSortBottle;
  /** 試験管ばさみで持っているとき、その柄を出す向き。 */
  heldBy?: ClampSide;
  /** 盤面で持った試験管ばさみを、注ぐ動きで持ったまま続けて見せるときに渡す。 */
  continuedClamp?: { swingRef: Ref<SVGGElement> };
  stoppered?: boolean;
  /** 栓を差し込む動きを呼び出し側が動かすときの、栓の要素。 */
  stopperRef?: RefObject<SVGSVGElement | null>;
  /** 注ぐ動きの中で栓を差すときに渡すと、栓が下りる前に、液がひとつの液に溶け合う様子をこの時刻で見せる。 */
  sealTiming?: TestTubeSealTiming;
  /** 液に重ねる、移っている途中の液。 */
  liquidOverlay?: ReactNode;
  receivingSameReagent?: boolean;
};

/** 真横から見た、目盛りつきの試験管。輪郭線・グラデーション・陰影を持たず、平らな面だけで描く。 */
export function TestTube({
  contents,
  heldBy,
  continuedClamp,
  stoppered = false,
  stopperRef,
  sealTiming,
  liquidOverlay,
  receivingSameReagent,
}: TestTubeProps) {
  return (
    <span aria-hidden="true" className="absolute inset-0">
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
      <GlassFront />
      {heldBy && (
        <TestTubeClamp
          side={heldBy}
          appears={!continuedClamp}
          swingRef={continuedClamp?.swingRef}
        />
      )}
    </span>
  );
}
