import { fukumenzanCatalogEntry } from "@/app/game-integration/fukumenzan/fukumenzan-catalog-entry";
import { PlayableFukumenzan } from "@/app/game-integration/fukumenzan/PlayableFukumenzan";
import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function FukumenzanPlayView() {
  const { problemId } = useParams(fukumenzanCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    fukumenzanCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={fukumenzanCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableFukumenzan
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
