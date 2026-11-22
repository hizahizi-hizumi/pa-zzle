import type { ReactNode } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  SUMMER_BOTTLE_VIEW_BOX,
  SUMMER_LIQUID_BOX,
} from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import {
  getLiquidStyle,
  type LiquidTopEdge,
} from "@/games/water-sort/ui/ideas/summer/summer-palette";

type BottleLiquidProps = {
  contents: WaterSortBottle;
  /** 注いでいる途中の色水。この枠の中に重ねる。 */
  overlay?: ReactNode;
  /** 中身の上に、注いでいる途中の色水が続くときの色。同じ色なら境を光らせない。 */
  continuingColorIndex?: number;
};

const BOTTLE_CAPACITY = 4;

const { width, height } = SUMMER_BOTTLE_VIEW_BOX;
const box = SUMMER_LIQUID_BOX;
const boxWidth = box.right - box.left;
const boxHeight = box.bottom - box.top;

const liquidBoxStyle = {
  left: `${(box.left / width) * 100}%`,
  right: `${((width - box.right) / width) * 100}%`,
  top: `${(box.top / height) * 100}%`,
  bottom: `${((height - box.bottom) / height) * 100}%`,
  borderBottomLeftRadius: `${(box.cornerRadius / boxWidth) * 100}% ${(box.cornerRadius / boxHeight) * 100}%`,
  borderBottomRightRadius: `${(box.cornerRadius / boxWidth) * 100}% ${(box.cornerRadius / boxHeight) * 100}%`,
};

type LiquidRun = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
};

/** 同じ色が続く段は、ひとつの水に溶け合っているので1つにまとめる。 */
function getLiquidRuns(contents: WaterSortBottle): LiquidRun[] {
  const runs: LiquidRun[] = [];
  contents.forEach((colorIndex, slot) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    runs.push({ colorIndex, startSlot: slot, slotCount: 1 });
  });
  return runs;
}

function getTopEdge(
  runIndex: number,
  runCount: number,
  colorIndex: number,
  continuingColorIndex: number | undefined,
): LiquidTopEdge {
  if (runIndex < runCount - 1) {
    return "boundary";
  }
  if (continuingColorIndex === undefined) {
    return "surface";
  }
  return continuingColorIndex === colorIndex ? "none" : "boundary";
}

export function BottleLiquid({
  contents,
  overlay,
  continuingColorIndex,
}: BottleLiquidProps) {
  const runs = getLiquidRuns(contents);

  return (
    <span className="absolute overflow-hidden" style={liquidBoxStyle}>
      {runs.map((run, runIndex) => (
        <span
          key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
          className="absolute inset-x-0"
          style={{
            bottom: `${(run.startSlot / BOTTLE_CAPACITY) * 100}%`,
            height: `calc(${(run.slotCount / BOTTLE_CAPACITY) * 100}% + 0.5px)`,
            ...getLiquidStyle(
              run.colorIndex,
              getTopEdge(
                runIndex,
                runs.length,
                run.colorIndex,
                continuingColorIndex,
              ),
            ),
          }}
        />
      ))}
      {overlay}
    </span>
  );
}
