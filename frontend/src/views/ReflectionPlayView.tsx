import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableReflection } from "@/app/game-integration/reflection/PlayableReflection";
import { reflectionCatalogEntry } from "@/app/game-integration/reflection/reflection-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function ReflectionPlayView() {
  const { problemId } = useParams(reflectionCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    reflectionCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={reflectionCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableReflection
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
