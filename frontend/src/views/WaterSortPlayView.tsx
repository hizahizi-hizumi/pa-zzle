import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { useParams } from "@/router";

export function WaterSortPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/water-sort/play/:difficulty",
  );
  const difficulty = parseWaterSortDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/water-sort"
      />
    );
  }

  return <PlayableWaterSort key={difficulty} difficulty={difficulty} />;
}
