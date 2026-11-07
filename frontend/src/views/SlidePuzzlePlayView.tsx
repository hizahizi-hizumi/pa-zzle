import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/game-catalog/play-location-state";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { useRandomPlayEntry } from "@/game-catalog/use-random-play-entry";
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
