import { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/WaterSortPlayView/InvalidDifficulty";
import { PlayableWaterSort } from "@/views/WaterSortPlayView/PlayableWaterSort";

export function WaterSortPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/water-sort/play/:difficulty",
  );
  const difficulty = parseWaterSortDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableWaterSort difficulty={difficulty} />;
}
