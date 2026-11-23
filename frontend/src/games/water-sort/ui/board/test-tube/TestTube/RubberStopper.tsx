import type { RefObject } from "react";

import {
  STOPPER_HEAD_TOP,
  TUBE_INNER,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const top = STOPPER_HEAD_TOP;
const plugBottom = TUBE_INNER.slotTop - 1.4;
const STOPPER_PATH = `M5 ${top} H31 Q32.2 ${top} 32 ${top + 1.2} L31.3 1.4 L29.9 ${plugBottom - 0.8} Q29.8 ${plugBottom} 29 ${plugBottom} H7 Q6.2 ${plugBottom} 6.1 ${plugBottom - 0.8} L4.7 1.4 L4 ${top + 1.2} Q3.8 ${top} 5 ${top} Z`;

type RubberStopperProps = {
  /** 栓を差し込む動きを、呼び出し側が動かすときに渡す。 */
  elementRef?: RefObject<SVGSVGElement | null>;
};

/** そろった試験管の口に差し込むゴム栓。真横から見た、口から上に頭が出て首の中へ細くなる台形の1色の面。 */
export function RubberStopper({ elementRef }: RubberStopperProps) {
  return (
    <svg
      ref={elementRef}
      data-rubber-stopper=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full origin-[50%_3%] overflow-visible"
      aria-hidden="true"
    >
      <path d={STOPPER_PATH} className="fill-[#b4523c] dark:fill-[#953f2e]" />
    </svg>
  );
}
