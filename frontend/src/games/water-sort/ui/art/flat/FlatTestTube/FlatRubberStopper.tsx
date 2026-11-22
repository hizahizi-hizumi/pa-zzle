import type { RefObject } from "react";

import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type FlatRubberStopperProps = {
  /** 栓を差し込む動きを、呼び出し側が動かすときに渡す。 */
  elementRef?: RefObject<SVGSVGElement | null>;
};

/** そろった試験管の口に差し込むゴム栓。真横から見た、口から上に頭が出て首の中へ細くなる台形の1色の面。 */
export function FlatRubberStopper({ elementRef }: FlatRubberStopperProps) {
  return (
    <svg
      ref={elementRef}
      data-rubber-stopper=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full origin-[50%_6%] overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M7.4 -3.4 H28.6 Q29.8 -3.4 29.6 -2.2 L28.3 6 L27.2 16.2 Q27.1 17.2 26.1 17.2 H9.9 Q8.9 17.2 8.8 16.2 L7.7 6 L6.4 -2.2 Q6.2 -3.4 7.4 -3.4 Z"
        className="fill-(--flat-rubber)"
      />
    </svg>
  );
}
