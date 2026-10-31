import { PlayableIceFloorMaze } from "@/game-catalog/ice-floor-maze/PlayableIceFloorMaze";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/IceFloorMazePlayView/InvalidDifficulty";

export function IceFloorMazePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/ice-floor-maze/play/:difficulty",
  );
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableIceFloorMaze key={difficulty} difficulty={difficulty} />;
}
