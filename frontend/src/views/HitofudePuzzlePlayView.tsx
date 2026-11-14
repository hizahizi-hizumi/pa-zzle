import { useLocation } from "react-router";
import { hitofudePuzzleCatalogEntry } from "@/app/game-integration/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { PlayableHitofudePuzzle } from "@/app/game-integration/hitofude-puzzle/PlayableHitofudePuzzle";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function HitofudePuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    hitofudePuzzleCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    hitofudePuzzleCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={hitofudePuzzleCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={hitofudePuzzleCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableHitofudePuzzle
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
