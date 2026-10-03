import { useLocation } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParams } from "@/router";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/parking-jam/play/:difficulty",
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseParkingJamDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/parking-jam"
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
