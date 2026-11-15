import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableWaterSort } from "@/app/game-integration/water-sort/PlayableWaterSort";
import { waterSortCatalogEntry } from "@/app/game-integration/water-sort/water-sort-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function WaterSortPlayView() {
  const { problemId } = useParams(waterSortCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    waterSortCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={waterSortCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableWaterSort
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
