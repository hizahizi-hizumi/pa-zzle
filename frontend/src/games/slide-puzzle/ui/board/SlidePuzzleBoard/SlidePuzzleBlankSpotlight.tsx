import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";
import {
  tileFaceShapeClassName,
  tileSizeClassByBoardSize,
} from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";

type SlidePuzzleBlankSpotlightProps = {
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
};

/** 手を引く間、タイルが収まる空白を決め手として、タイルの面と同じ位置・角丸で画面全体の覆いから抜く。 */
export function SlidePuzzleBlankSpotlight({
  cellIndex,
  boardSize,
}: SlidePuzzleBlankSpotlightProps) {
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]}`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <TutorialSpotlight active className={tileFaceShapeClassName} />
    </span>
  );
}
