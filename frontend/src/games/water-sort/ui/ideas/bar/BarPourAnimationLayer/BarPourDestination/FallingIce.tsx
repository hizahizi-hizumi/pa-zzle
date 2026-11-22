import { useEffect, useRef } from "react";

import {
  BAR_POUR_DURATION_MS,
  BAR_POUR_EASING,
  BAR_POUR_PHASE,
} from "@/games/water-sort/ui/ideas/bar/bar-pour-timeline";
import { IceCube } from "@/games/water-sort/ui/ideas/bar/IceCube";

type FallingIceProps = {
  glassHeight: number;
};

/** そろったグラスに、上から氷がひとつ落ちて液面に浮かぶ。落ちた所に小さな輪が広がる。 */
export function FallingIce({ glassHeight }: FallingIceProps) {
  const iceRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fall = glassHeight * 0.55;
    const { iceDrop, iceLand } = BAR_POUR_PHASE;
    const iceAnimation = iceRef.current?.animate?.(
      [
        { opacity: 0, translate: `0 ${-fall}px`, offset: 0 },
        {
          opacity: 0,
          translate: `0 ${-fall}px`,
          offset: iceDrop,
          easing: "cubic-bezier(.5,0,1,1)",
        },
        {
          opacity: 1,
          translate: `0 ${glassHeight * 0.025}px`,
          offset: iceLand,
          easing: BAR_POUR_EASING.settle,
        },
        { opacity: 1, translate: "0 -1px", offset: iceLand + 0.05 },
        { opacity: 1, translate: "0 0px", offset: 1 },
      ],
      { duration: BAR_POUR_DURATION_MS, fill: "both" },
    );
    const ringAnimation = ringRef.current?.animate?.(
      [
        { opacity: 0, transform: "scaleX(0.3)", offset: 0 },
        { opacity: 0, transform: "scaleX(0.3)", offset: iceLand - 0.01 },
        { opacity: 0.85, transform: "scaleX(0.6)", offset: iceLand },
        { opacity: 0, transform: "scaleX(1.15)", offset: 1 },
      ],
      { duration: BAR_POUR_DURATION_MS, fill: "both" },
    );
    return () => {
      iceAnimation?.cancel();
      ringAnimation?.cancel();
    };
  }, [glassHeight]);

  return (
    <>
      <span
        ref={ringRef}
        className="absolute top-[4.5%] left-[10%] h-[3.5%] w-[80%] rounded-[50%] border border-white/80 opacity-0"
      />
      <IceCube elementRef={iceRef} />
    </>
  );
}
