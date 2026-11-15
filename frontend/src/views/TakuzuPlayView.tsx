import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableTakuzu } from "@/app/game-integration/takuzu/PlayableTakuzu";
import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function TakuzuPlayView() {
  const { problemId } = useParams(takuzuCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(takuzuCatalogEntry, problemId);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={takuzuCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableTakuzu
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
