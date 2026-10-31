import type { Ref } from "react";

import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";

/** 盤面の幅を一辺のマス数で等分する。 */
const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  /** 押すタイルとして示すときの印の `id`。示さなければ `null`。 */
  hintId: number | null;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  hintId,
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
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <SlidePuzzleTileFace tile={tile} boardSize={boardSize} ref={faceRef} />
      {hintId !== null && (
        <span
          key={hintId}
          aria-hidden="true"
          data-tile-cue="hint"
          className="pointer-events-none absolute inset-[3cqw] rounded-[1.2cqw] border-2 border-sky-600/60 border-dashed animate-in fade-in-0 duration-500 motion-reduce:animate-none dark:border-sky-300/60"
        />
      )}
    </button>
  );
}
