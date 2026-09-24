import { parseFifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/FifteenPuzzlePlayView/InvalidDifficulty";
import { PlayableFifteenPuzzle } from "@/views/FifteenPuzzlePlayView/PlayableFifteenPuzzle";

export function FifteenPuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/fifteen-puzzle/play/:difficulty",
  );
  const difficulty = parseFifteenPuzzleDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableFifteenPuzzle difficulty={difficulty} />;
}
