import type { Ref } from "react";

import {
  getElixirStyle,
  getElixirSurfaceShadow,
} from "@/games/water-sort/ui/ideas/alchemy/alchemy-elixirs";

type ElixirBandProps = {
  colorIndex: number;
  /** 下から数えた帯の始まりの段。 */
  startSlot: number;
  slotCount: number;
  /** 注ぐ演出で、帯を伸び縮みさせるときに渡す。 */
  bandRef?: Ref<HTMLSpanElement>;
  initialScaleY?: number;
};

/** 同じ霊液がひと続きに溜まった帯。 */
export function ElixirBand({
  colorIndex,
  startSlot,
  slotCount,
  bandRef,
  initialScaleY,
}: ElixirBandProps) {
  return (
    <span
      ref={bandRef}
      className="absolute inset-x-0 origin-bottom"
      style={{
        ...getElixirStyle(colorIndex),
        bottom: `${startSlot * 25}%`,
        // 下の帯と継ぎ目が透けないよう、わずかに重ねる。
        height: `calc(${slotCount * 25}% + 0.5px)`,
        boxShadow: getElixirSurfaceShadow(colorIndex),
        ...(initialScaleY === undefined
          ? {}
          : { transform: `scaleY(${initialScaleY})` }),
      }}
    />
  );
}
