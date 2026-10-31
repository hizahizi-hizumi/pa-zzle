import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { PlayableReflection } from "@/game-catalog/reflection/PlayableReflection";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function ReflectionPlayView() {
  const { difficulty: difficultyParam } = useParams(
    reflectionCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={reflectionCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableReflection
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
