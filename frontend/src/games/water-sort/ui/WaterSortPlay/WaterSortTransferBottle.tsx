import type { CSSProperties, ReactNode } from "react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { getWaterSortTopColorUnits } from "@/games/water-sort/puzzle/rules";
import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { getWaterSortTransferDurationMs } from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";

type WaterSortTransferBottleProps = {
  bottle: WaterSortBottle;
  index: number;
  operation: Extract<WaterSortOperation, { type: "poured" }> | null;
  justFinished: boolean;
  justSettled: boolean;
  held: boolean;
  selected: boolean;
};

export function WaterSortTransferBottle({
  bottle,
  index,
  operation,
  justFinished,
  justSettled,
  held,
  selected,
}: WaterSortTransferBottleProps) {
  const source = operation?.sourceBottleIndex === index;
  const destination = operation?.destinationBottleIndex === index;
  const before = operation?.stateBefore[index] ?? bottle;
  const after = operation?.stateAfter[index] ?? bottle;
  const base = source ? after : destination ? before : bottle;
  const incomingColor =
    operation?.stateBefore[operation.sourceBottleIndex]?.at(-1);
  const amount = source
    ? before.length - after.length
    : destination
      ? after.length - before.length
      : 0;
  const heldUnits = held ? getWaterSortTopColorUnits(bottle) : 0;
  const heldGap: ReactNode = heldUnits > 0 && (
    <span
      className="water-sort-held-gap"
      style={{
        bottom: `${(bottle.length - heldUnits) * 25}%`,
        height: `${heldUnits * 25}%`,
      }}
    />
  );
  const merging = destination && amount > 0 && before.at(-1) === incomingColor;
  const merge: ReactNode = merging && (
    <span
      className="water-sort-liquid-merge"
      data-testid="liquid-merge"
      style={{ bottom: `${before.length * 25}%` }}
    />
  );
  const transfer: ReactNode =
    amount > 0 && incomingColor !== undefined ? (
      <span
        key={`${operation?.id}-${index}`}
        data-testid="liquid-transfer"
        data-direction={source ? "out" : "in"}
        className="water-sort-experiment-transfer"
        style={
          {
            bottom: `${base.length * 25}%`,
            height: `${amount * 25}%`,
            backgroundColor: getWaterColorView(incomingColor).color,
            "--water-sort-transfer-duration": `${getWaterSortTransferDurationMs(amount)}ms`,
          } as CSSProperties
        }
      />
    ) : undefined;

  const topColor = bottle.at(-1);
  const selectedColor =
    selected && topColor !== undefined
      ? getWaterColorView(topColor).color
      : undefined;
  const completedColor =
    isCompleteWaterSortBottle(bottle) && !destination && bottle[0] !== undefined
      ? getWaterColorView(bottle[0]).color
      : undefined;

  return (
    <span
      className="water-sort-experiment-bottle absolute inset-0"
      data-just-finished={justFinished}
      data-just-settled={justSettled}
      data-held={held}
      data-selected={selected}
      data-transfer-role={
        source ? "source" : destination ? "destination" : undefined
      }
      data-merging={merging}
      data-complete={completedColor !== undefined}
      style={
        {
          ...(completedColor && {
            "--water-sort-completed-color": completedColor,
          }),
          ...(selectedColor && {
            "--water-sort-selected-color": selectedColor,
          }),
          ...(amount > 0 && {
            "--water-sort-transfer-duration": `${getWaterSortTransferDurationMs(amount)}ms`,
            "--water-sort-motion-amplitude": `${1.5 + amount * 0.6}px`,
          }),
        } as CSSProperties
      }
    >
      <WaterBottle
        contents={base}
        waterOverlay={
          <>
            {transfer}
            {merge}
            {heldGap}
          </>
        }
        selected={selected}
        variant="fluid"
      />
      {completedColor && <span className="water-sort-completed-seal" />}
    </span>
  );
}
