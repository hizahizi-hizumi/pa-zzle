import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { PlayableBridges } from "@/game-catalog/bridges/PlayableBridges";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function BridgesPlayView() {
  const { difficulty: difficultyParam } = useParams(
    bridgesCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={bridgesCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableBridges
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
