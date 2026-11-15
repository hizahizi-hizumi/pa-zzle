import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { hitofudePuzzleCatalogEntry } from "@/app/game-integration/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { PlayableHitofudePuzzle } from "@/app/game-integration/hitofude-puzzle/PlayableHitofudePuzzle";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function HitofudePuzzlePlayView() {
  const { problemId } = useParams(hitofudePuzzleCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    hitofudePuzzleCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={hitofudePuzzleCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableHitofudePuzzle
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
