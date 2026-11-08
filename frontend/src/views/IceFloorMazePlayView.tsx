import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { PlayableIceFloorMaze } from "@/game-catalog/ice-floor-maze/PlayableIceFloorMaze";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/game-catalog/play-location-state";
import { useRandomPlayEntry } from "@/game-catalog/use-random-play-entry";
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
