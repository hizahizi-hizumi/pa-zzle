import type { Ref } from "react";

import {
  type FifteenPuzzleTile as FifteenPuzzleTileNumber,
  getFifteenPuzzleColumn,
  getFifteenPuzzleRow,
} from "@/games/fifteen-puzzle/puzzle/state";

type FifteenPuzzleTileProps = {
  tile: FifteenPuzzleTileNumber;
  cellIndex: number;
  disabled: boolean;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function FifteenPuzzleTile({
  tile,
  cellIndex,
  disabled,
  slideAnimated,
  faceRef,
  onPress,
}: FifteenPuzzleTileProps) {
  const row = getFifteenPuzzleRow(cellIndex);
  const column = getFifteenPuzzleColumn(cellIndex);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className={`group absolute top-0 left-0 size-1/4 cursor-pointer touch-manipulation select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        slideAnimated
          ? "transition-transform duration-normal ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <span
        ref={faceRef}
        className="flex size-full items-center justify-center rounded-[1.6cqw] border border-border bg-card font-sans text-[8cqw] leading-none font-semibold text-card-foreground tabular-nums shadow-raised transition-colors duration-fast group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring"
      >
        {tile}
      </span>
    </button>
  );
}
