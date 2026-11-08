import type { CSSProperties, ReactNode } from "react";

import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";

import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import "@/games/water-sort/ui/board/water-bottle/water-bottle.css";

import { Bottle } from "@/games/water-sort/ui/board/water-bottle/Bottle";
import { GlassBottle } from "@/games/water-sort/ui/board/water-bottle/GlassBottle";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { Water } from "@/games/water-sort/ui/board/water-bottle/Water";

type WaterBottleProps = {
  contents: WaterSortBottle;
  appearance?: WaterSortAppearance;
  selected?: boolean;
  waterOverlay?: ReactNode;
};

export function WaterBottle({
  contents,
  appearance = "classic",
  selected = false,
  waterOverlay,
}: WaterBottleProps) {
  return (
    <span
      aria-hidden="true"
      className="water-sort-bottle absolute inset-0"
      data-appearance={appearance}
      data-complete={isCompleteWaterSortBottle(contents)}
      style={
        {
          "--water-base-color":
            contents[0] === undefined
              ? "transparent"
              : getWaterColorView(contents[0]).color,
        } as CSSProperties
      }
    >
      {appearance === "glass" ? (
        <GlassBottle contents={contents} selected={selected} />
      ) : (
        <>
          <span className="water-sort-bottle-interior absolute inset-x-[4px] bottom-[4px] top-3 overflow-hidden rounded-b-[1.15rem] bg-black/[0.015]">
            <span className="water-sort-fluid-volume absolute inset-0">
              <Water contents={contents} appearance={appearance} />
              {waterOverlay}
            </span>
          </span>
          <Bottle selected={selected} />
        </>
      )}
    </span>
  );
}
