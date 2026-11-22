import type { ReactNode, RefObject } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { GlassBack } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassBack";
import { GlassFront } from "@/games/water-sort/ui/board/test-tube/TestTube/GlassFront";
import { Liquid } from "@/games/water-sort/ui/board/test-tube/TestTube/Liquid";
import { RubberStopper } from "@/games/water-sort/ui/board/test-tube/TestTube/RubberStopper";
import { TestTubeClamp } from "@/games/water-sort/ui/board/test-tube/TestTube/TestTubeClamp";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type TestTubeProps = {
  contents: WaterSortBottle;
  /** 試験管ばさみで持っているとき、その柄を出す向き。 */
  heldBy?: "left" | "right";
  stoppered?: boolean;
  /** 栓を差し込む動きを呼び出し側が動かすときの、栓の要素。 */
  stopperRef?: RefObject<SVGSVGElement | null>;
  /** 液に重ねる、移っている途中の液。 */
  liquidOverlay?: ReactNode;
  receivingSameReagent?: boolean;
};

export function TestTube({
  contents,
  heldBy,
  stoppered = false,
  stopperRef,
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
      </span>
      {stoppered && <RubberStopper elementRef={stopperRef} />}
      <GlassFront held={heldBy !== undefined} />
      {heldBy && <TestTubeClamp side={heldBy} />}
    </span>
  );
}
