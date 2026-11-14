import { useLocation } from "react-router";
import { PlayableParkingJam } from "@/app/game-integration/parking-jam/PlayableParkingJam";
import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import { useRandomPlayEntry } from "@/app/game-integration/use-random-play-entry";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/app/navigation/play-location-state";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    parkingJamCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    parkingJamCatalogEntry,
    difficulty,
    avoidedProblemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={parkingJamCatalogEntry.homePath}
      />
    );
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={parkingJamCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableParkingJam
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
