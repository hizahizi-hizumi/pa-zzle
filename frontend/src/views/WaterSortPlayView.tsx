import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/game-catalog/play-location-state";
import { useRandomPlayEntry } from "@/game-catalog/use-random-play-entry";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function WaterSortPlayView() {
  const { difficulty: difficultyParam } = useParams(
    waterSortCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    waterSortCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={waterSortCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={waterSortCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableWaterSort
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
