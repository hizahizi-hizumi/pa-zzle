import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { PlayableNanpure } from "@/app/game-integration/nanpure/PlayableNanpure";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function NanpurePlayView() {
  const { problemId } = useParams(nanpureCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(nanpureCatalogEntry, problemId);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={nanpureCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableNanpure
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
