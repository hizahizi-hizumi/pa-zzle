import {
  FIFTEEN_PUZZLE_BLANK,
  FIFTEEN_PUZZLE_SIZE,
  type FifteenPuzzleBoard as FifteenPuzzleBoardState,
} from "@/games/fifteen-puzzle/puzzle/state";
import { FifteenPuzzleTile } from "@/games/fifteen-puzzle/ui/board/FifteenPuzzleBoard/FifteenPuzzleTile";

type FifteenPuzzleBoardProps = {
  board: FifteenPuzzleBoardState;
  interactionDisabled: boolean;
  onSlideTile: (tileIndex: number) => void;
};

export function FifteenPuzzleBoard({
  board,
  interactionDisabled,
  onSlideTile,
}: FifteenPuzzleBoardProps) {
  const tiles = board
    .map((tile, cellIndex) => ({ tile, cellIndex }))
    .filter(({ tile }) => tile !== FIFTEEN_PUZZLE_BLANK)
    .sort((left, right) => left.tile - right.tile);

  return (
    <div
      role="group"
      aria-label="盤面"
      className="grid aspect-square w-full max-w-[26rem] gap-1.5 rounded-lg bg-muted p-1.5"
      style={{
        gridTemplateColumns: `repeat(${FIFTEEN_PUZZLE_SIZE}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${FIFTEEN_PUZZLE_SIZE}, minmax(0, 1fr))`,
      }}
    >
      {tiles.map(({ tile, cellIndex }) => (
        <FifteenPuzzleTile
          key={tile}
          tile={tile}
          cellIndex={cellIndex}
          disabled={interactionDisabled}
          onPress={onSlideTile}
        />
      ))}
    </div>
  );
}
