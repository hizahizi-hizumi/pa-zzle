import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/ParkingJamPlayView/InvalidDifficulty";
import { PlayableParkingJam } from "@/views/ParkingJamPlayView/PlayableParkingJam";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/parking-jam/play/:difficulty",
  );
  const difficulty = parseParkingJamDifficulty(difficultyParam);

  if (!difficulty) return <InvalidDifficulty />;

  return <PlayableParkingJam difficulty={difficulty} />;
}
