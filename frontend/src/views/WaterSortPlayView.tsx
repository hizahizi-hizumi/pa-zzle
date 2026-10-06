import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function WaterSortPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/water-sort/play/:difficulty",
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/water-sort"
      />
    );
  }

  return (
    <PlayableWaterSort
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
