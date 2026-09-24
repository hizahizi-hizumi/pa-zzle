import {
  type FifteenPuzzleTile as FifteenPuzzleTileNumber,
  getFifteenPuzzleColumn,
  getFifteenPuzzleRow,
} from "@/games/fifteen-puzzle/puzzle/state";

type FifteenPuzzleTileProps = {
  tile: FifteenPuzzleTileNumber;
  cellIndex: number;
  disabled: boolean;
  onPress: (cellIndex: number) => void;
};

export function FifteenPuzzleTile({
  tile,
  cellIndex,
  disabled,
  onPress,
}: FifteenPuzzleTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className="flex min-h-0 min-w-0 items-center justify-center rounded-md border border-border bg-card font-sans text-screen-title text-card-foreground tabular-nums shadow-raised transition-transform duration-fast active:scale-95 disabled:pointer-events-none"
      style={{
        gridRowStart: getFifteenPuzzleRow(cellIndex) + 1,
        gridColumnStart: getFifteenPuzzleColumn(cellIndex) + 1,
      }}
    >
      {tile}
    </button>
  );
}
