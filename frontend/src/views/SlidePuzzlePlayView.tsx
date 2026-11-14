import { useLocation } from "react-router";
import { PlayableSlidePuzzle } from "@/app/game-integration/slide-puzzle/PlayableSlidePuzzle";
import { slidePuzzleCatalogEntry } from "@/app/game-integration/slide-puzzle/slide-puzzle-catalog-entry";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function SlidePuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    slidePuzzleCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    slidePuzzleCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={slidePuzzleCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={slidePuzzleCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableSlidePuzzle
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
