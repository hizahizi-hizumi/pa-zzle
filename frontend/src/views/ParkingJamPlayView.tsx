import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParams } from "@/router";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/parking-jam/play/:difficulty",
  );
  const difficulty = parseParkingJamDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/parking-jam"
      />
    );
  }

  return <PlayableParkingJam key={difficulty} difficulty={difficulty} />;
}
