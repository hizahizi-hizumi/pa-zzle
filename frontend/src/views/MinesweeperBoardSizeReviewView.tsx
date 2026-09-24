import { useSearchParams } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMinesweeperProblemPlay } from "@/games/minesweeper/play/use-minesweeper-problem-play";
import {
  createMinesweeperBoardSizeReviewProblem,
  type MinesweeperBoardSizeReviewSize,
  parseMinesweeperBoardSizeReviewSize,
} from "@/games/minesweeper/problem/board-size-review-problem";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import { useNavigate } from "@/router";

// 最大盤面サイズを人が比較するための仮画面。
export function MinesweeperBoardSizeReviewView() {
  const [searchParams] = useSearchParams();
  const size = parseMinesweeperBoardSizeReviewSize(
    searchParams.get("rows"),
    searchParams.get("columns"),
  );

  if (!size) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert>
          <AlertTitle>盤面サイズが不正です</AlertTitle>
          <AlertDescription>
            rows と columns に 5〜30 の整数を指定してください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <BoardSizeReviewPlay key={`${size.rows}x${size.columns}`} size={size} />
  );
}

function BoardSizeReviewPlay({
  size,
}: {
  size: MinesweeperBoardSizeReviewSize;
}) {
  const play = useMinesweeperProblemPlay(
    createMinesweeperBoardSizeReviewProblem(size),
  );
  const navigate = useNavigate();

  return (
    <MinesweeperPlay
      rows={play.rows}
      columns={play.columns}
      mineCount={play.mineCount}
      flagCount={play.flagCount}
      visibleCells={play.visibleCells}
      status={play.status}
      onRevealCell={play.revealCell}
      onToggleFlag={play.toggleFlag}
      onChordCell={play.chordCell}
      onReplay={play.replay}
      onChangeDifficulty={() => navigate("/puzzles/minesweeper")}
      onBackToHome={() => navigate("/")}
    />
  );
}
