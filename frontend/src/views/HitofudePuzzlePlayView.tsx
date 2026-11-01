import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { hitofudePuzzleCatalogEntry } from "@/game-catalog/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { PlayableHitofudePuzzle } from "@/game-catalog/hitofude-puzzle/PlayableHitofudePuzzle";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function HitofudePuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    hitofudePuzzleCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={hitofudePuzzleCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableHitofudePuzzle
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
