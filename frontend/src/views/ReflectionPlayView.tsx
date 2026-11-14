import { useLocation } from "react-router";
import { PlayableReflection } from "@/app/game-integration/reflection/PlayableReflection";
import { reflectionCatalogEntry } from "@/app/game-integration/reflection/reflection-catalog-entry";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function ReflectionPlayView() {
  const { difficulty: difficultyParam } = useParams(
    reflectionCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    reflectionCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={reflectionCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={reflectionCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableReflection
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
