import { type RefObject, useId } from "react";

import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type RubberStopperProps = {
  /** 栓を差し込む動きを、呼び出し側が動かすときに渡す。 */
  elementRef?: RefObject<SVGSVGElement | null>;
};

/** そろった試験管の口に差し込むゴム栓。口から上に頭が出て、下は首の中へ細くなる。 */
export function RubberStopper({ elementRef }: RubberStopperProps) {
  const bodyId = useId();
  const topId = useId();
  return (
    <svg
      ref={elementRef}
      data-rubber-stopper=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full origin-[50%_6%] overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3f1712" />
          <stop offset="0.28" stopColor="#8d3a2b" />
          <stop offset="0.45" stopColor="#a54a37" />
          <stop offset="0.75" stopColor="#6e2a1f" />
          <stop offset="1" stopColor="#35130f" />
        </linearGradient>
        <linearGradient id={topId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a3527" />
          <stop offset="0.4" stopColor="#c0644e" />
          <stop offset="1" stopColor="#6a2a1f" />
        </linearGradient>
      </defs>
      <path
        d="M6.6 -2.4 H29.4 L28.3 6 L27.2 16.2 Q27.1 17.2 26.1 17.2 H9.9 Q8.9 17.2 8.8 16.2 L7.7 6 Z"
        fill={`url(#${bodyId})`}
      />
      <ellipse cx="18" cy="-2.4" rx="11.4" ry="1.7" fill={`url(#${topId})`} />
      <path
        d="M10.5 -1.2 Q18 0.4 25.5 -1.2"
        fill="none"
        stroke="rgba(255,220,200,0.35)"
        strokeWidth="0.4"
      />
    </svg>
  );
}
