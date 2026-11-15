import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableSlidePuzzle } from "@/app/game-integration/slide-puzzle/PlayableSlidePuzzle";
import { slidePuzzleCatalogEntry } from "@/app/game-integration/slide-puzzle/slide-puzzle-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function SlidePuzzlePlayView() {
  const { problemId } = useParams(slidePuzzleCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    slidePuzzleCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={slidePuzzleCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableSlidePuzzle
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
