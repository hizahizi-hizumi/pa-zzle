import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTile } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";

type SlidePuzzleBoardProps = {
  board: SlidePuzzleBoardState;
  interactionDisabled: boolean;
  onSlideTile: (tileIndex: number) => void;
};

export function SlidePuzzleBoard({
  board,
  interactionDisabled,
  onSlideTile,
}: SlidePuzzleBoardProps) {
  const boardSize = getSlidePuzzleBoardSize(board);
  const tiles = board
    .map((tile, cellIndex) => ({ tile, cellIndex }))
    .filter(({ tile }) => tile !== SLIDE_PUZZLE_BLANK)
    .sort((left, right) => left.tile - right.tile);

  return (
    <div
      role="group"
      aria-label="盤面"
      className="grid aspect-square w-full max-w-[26rem] gap-1.5 rounded-lg bg-muted p-1.5"
      style={{
        gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
      }}
    >
      {tiles.map(({ tile, cellIndex }) => (
        <SlidePuzzleTile
          key={tile}
          tile={tile}
          cellIndex={cellIndex}
          boardSize={boardSize}
          disabled={interactionDisabled}
          onPress={onSlideTile}
        />
      ))}
    </div>
  );
}
