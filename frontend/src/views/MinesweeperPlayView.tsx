import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { PlayableMinesweeper } from "@/app/game-integration/minesweeper/PlayableMinesweeper";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function MinesweeperPlayView() {
  const { problemId } = useParams(minesweeperCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    minesweeperCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={minesweeperCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableMinesweeper
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
