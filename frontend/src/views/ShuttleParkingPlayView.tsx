import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableShuttleParking } from "@/app/game-integration/shuttle-parking/PlayableShuttleParking";
import { shuttleParkingCatalogEntry } from "@/app/game-integration/shuttle-parking/shuttle-parking-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useParams } from "@/router";

export function ShuttleParkingPlayView() {
  const { problemId } = useParams(shuttleParkingCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    shuttleParkingCatalogEntry,
    problemId,
  );

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={shuttleParkingCatalogEntry.homePath}
      />
    );
  }

  return (
    <PlayableShuttleParking
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
