import type { ReactNode, RefObject } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  LabClamp,
  type LabClampSide,
} from "@/games/water-sort/ui/ideas/lab/LabTestTube/LabClamp";
import { LabGlassBack } from "@/games/water-sort/ui/ideas/lab/LabTestTube/LabGlassBack";
import { LabGlassFront } from "@/games/water-sort/ui/ideas/lab/LabTestTube/LabGlassFront";
import { LabLiquid } from "@/games/water-sort/ui/ideas/lab/LabTestTube/LabLiquid";
import { LabStopper } from "@/games/water-sort/ui/ideas/lab/LabTestTube/LabStopper";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/ideas/lab/lab-tube-geometry";

type LabTestTubeProps = {
  contents: WaterSortBottle;
  /** 試験管ばさみで持っているとき、その柄を出す向き。 */
  heldBy?: LabClampSide;
  /** ゴム栓を差しているか。 */
  stoppered?: boolean;
  /** 栓を差し込む動きを呼び出し側が動かすときの、栓の要素。 */
  stopperRef?: RefObject<SVGSVGElement | null>;
  /** 液に重ねる、移っている途中の液。 */
  liquidOverlay?: ReactNode;
  receivingSameReagent?: boolean;
};

export function LabTestTube({
  contents,
  heldBy,
  stoppered = false,
  stopperRef,
  liquidOverlay,
  receivingSameReagent,
}: LabTestTubeProps) {
  return (
    <span aria-hidden="true" className="absolute inset-0">
      <LabGlassBack />
      <span className="absolute overflow-hidden" style={LIQUID_BOX_STYLE}>
        <LabLiquid
          contents={contents}
          receivingSameReagent={receivingSameReagent}
        />
        {liquidOverlay}
      </span>
      {stoppered && <LabStopper elementRef={stopperRef} />}
      <LabGlassFront held={heldBy !== undefined} />
      {heldBy && <LabClamp side={heldBy} />}
    </span>
  );
}
