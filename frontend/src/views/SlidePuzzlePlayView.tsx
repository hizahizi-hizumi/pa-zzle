import { parseSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/SlidePuzzlePlayView/InvalidDifficulty";
import { PlayableSlidePuzzle } from "@/views/SlidePuzzlePlayView/PlayableSlidePuzzle";

export function SlidePuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/slide-puzzle/play/:difficulty",
  );
  const difficulty = parseSlidePuzzleDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableSlidePuzzle difficulty={difficulty} />;
}
