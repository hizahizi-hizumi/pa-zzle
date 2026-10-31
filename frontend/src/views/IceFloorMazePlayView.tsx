import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { PlayableIceFloorMaze } from "@/game-catalog/ice-floor-maze/PlayableIceFloorMaze";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function IceFloorMazePlayView() {
  const { difficulty: difficultyParam } = useParams(
    iceFloorMazeCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={iceFloorMazeCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableIceFloorMaze
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
