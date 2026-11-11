import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { PlayableBridges } from "@/game-catalog/bridges/PlayableBridges";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/game-catalog/play-location-state";
import { useRandomPlayEntry } from "@/game-catalog/use-random-play-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function BridgesPlayView() {
  const { difficulty: difficultyParam } = useParams(
    bridgesCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    bridgesCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={bridgesCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={bridgesCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableBridges
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
