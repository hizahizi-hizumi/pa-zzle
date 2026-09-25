import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  onPress,
}: SlidePuzzleTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className="flex min-h-0 min-w-0 items-center justify-center rounded-md border border-border bg-card font-sans text-screen-title text-card-foreground tabular-nums shadow-raised transition-transform duration-fast active:scale-95 disabled:pointer-events-none"
      style={{
        gridRowStart: getSlidePuzzleRow(cellIndex, boardSize) + 1,
        gridColumnStart: getSlidePuzzleColumn(cellIndex, boardSize) + 1,
      }}
    >
      {tile}
    </button>
  );
}
