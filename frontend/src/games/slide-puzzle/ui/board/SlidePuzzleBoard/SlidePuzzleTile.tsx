import type { Ref } from "react";

import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";

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
  cue: SlidePuzzleTileCue | undefined;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  cue,
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
      {cue?.kind === "landed" && (
        <span
          key={cue.id}
          aria-hidden="true"
          data-tile-cue={cue.kind}
          className="pointer-events-none absolute inset-[1cqw] rounded-[1.6cqw] border-(length:--border-width-normal) border-foreground fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard"
        />
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-tile-cue="hint"
          className="pointer-events-none absolute inset-[1cqw] rounded-[1.6cqw] border-(length:--border-width-strong) border-ring animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none"
        />
      )}
      {cue?.kind === "recall" && (
        <span
          key={cue.id}
          aria-hidden="true"
          data-tile-cue={cue.kind}
          className="pointer-events-none absolute inset-[1cqw] rounded-[1.6cqw] border-(length:--border-width-strong) border-foreground fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard"
        />
      )}
    </button>
  );
}
