import type { Ref } from "react";

import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";

/** 盤面の幅を一辺のマス数で等分し、数字はタイル幅の約 3 分の 1 にする。 */
const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};
const tileNumberClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "text-[10.6cqw]",
  4: "text-[8cqw]",
  5: "text-[6.4cqw]",
};

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  slideAnimated,
  faceRef,
  onPress,
}: SlidePuzzleTileProps) {
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer touch-manipulation select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        slideAnimated
          ? "transition-transform duration-normal ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <span
        ref={faceRef}
        className={`flex size-full items-center justify-center rounded-[1.6cqw] border border-border bg-card font-sans ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold text-card-foreground tabular-nums shadow-raised transition-colors duration-fast group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring`}
      >
        {tile}
      </span>
    </button>
  );
}
