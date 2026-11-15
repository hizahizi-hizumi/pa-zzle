import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { iceFloorMazeCatalogEntry } from "@/app/game-integration/ice-floor-maze/ice-floor-maze-catalog-entry";
import { PlayableIceFloorMaze } from "@/app/game-integration/ice-floor-maze/PlayableIceFloorMaze";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function IceFloorMazePlayView() {
  const { problemId } = useParams(iceFloorMazeCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    iceFloorMazeCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={iceFloorMazeCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableIceFloorMaze
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
