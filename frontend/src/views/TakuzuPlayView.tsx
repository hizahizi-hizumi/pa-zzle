import { useLocation } from "react-router";
import { PlayableTakuzu } from "@/app/game-integration/takuzu/PlayableTakuzu";
import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function TakuzuPlayView() {
  const { difficulty: difficultyParam } = useParams(
    takuzuCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    takuzuCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={takuzuCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={takuzuCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableTakuzu
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
