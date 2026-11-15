import { bridgesCatalogEntry } from "@/app/game-integration/bridges/bridges-catalog-entry";
import { PlayableBridges } from "@/app/game-integration/bridges/PlayableBridges";
import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function BridgesPlayView() {
  const { problemId } = useParams(bridgesCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(bridgesCatalogEntry, problemId);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={bridgesCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableBridges
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
