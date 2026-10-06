import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    parkingJamCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={parkingJamCatalogEntry.entryPath}
      />
    );
  }

  return (
    <PlayableParkingJam
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
