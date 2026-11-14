import { useLocation } from "react-router";
import { iceFloorMazeCatalogEntry } from "@/app/game-integration/ice-floor-maze/ice-floor-maze-catalog-entry";
import { PlayableIceFloorMaze } from "@/app/game-integration/ice-floor-maze/PlayableIceFloorMaze";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function IceFloorMazePlayView() {
  const { difficulty: difficultyParam } = useParams(
    iceFloorMazeCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    iceFloorMazeCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={iceFloorMazeCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={iceFloorMazeCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableIceFloorMaze
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
