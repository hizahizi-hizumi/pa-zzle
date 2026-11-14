import { useLocation } from "react-router";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { PlayableNanpure } from "@/app/game-integration/nanpure/PlayableNanpure";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function NanpurePlayView() {
  const { difficulty: difficultyParam } = useParams(
    nanpureCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    nanpureCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={nanpureCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={nanpureCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableNanpure
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
