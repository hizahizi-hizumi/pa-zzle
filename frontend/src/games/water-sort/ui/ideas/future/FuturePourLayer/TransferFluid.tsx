import type { RefObject } from "react";

import {
  FIELD_BARRIER_BACKGROUND,
  getFluidSurfaceSheen,
  getFutureFluidFill,
} from "@/games/water-sort/ui/ideas/future/future-palette";

type TransferFluidProps = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  /** 下の液と色が違い、場の隔てを引くとき `true`。 */
  separated: boolean;
  elementRef: RefObject<HTMLSpanElement | null>;
  initialFill: number;
};

/** 液面の照りと隔てを潰さないよう、伸び縮みではなく高さで量を表す。 */
export function getTransferFluidHeight(slotCount: number, fill: number) {
  return `${slotCount * 25 * fill}%`;
}

/** 管の中で、場に引き出されて減っていく液と、受け止められて増えていく液。 */
export function TransferFluid({
  colorIndex,
  startSlot,
  slotCount,
  separated,
  elementRef,
  initialFill,
}: TransferFluidProps) {
  return (
    <span
      ref={elementRef}
      className="absolute inset-x-0"
      style={{
        bottom: `${startSlot * 25}%`,
        height: getTransferFluidHeight(slotCount, initialFill),
        background: getFutureFluidFill(colorIndex),
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: getFluidSurfaceSheen(colorIndex),
          opacity: 0.8,
        }}
      />
      {separated && (
        <span
          className="absolute inset-x-0 bottom-0 h-[3px] translate-y-1/2"
          style={{
            background: FIELD_BARRIER_BACKGROUND,
          }}
        />
      )}
    </span>
  );
}
