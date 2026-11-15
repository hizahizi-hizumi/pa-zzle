import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableParkingJam } from "@/app/game-integration/parking-jam/PlayableParkingJam";
import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function ParkingJamPlayView() {
  const { problemId } = useParams(parkingJamCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    parkingJamCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={parkingJamCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableParkingJam
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
