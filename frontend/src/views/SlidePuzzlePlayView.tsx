import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import { parseSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useParams } from "@/router";

export function SlidePuzzlePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/slide-puzzle/play/:difficulty",
  );
  const difficulty = parseSlidePuzzleDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/slide-puzzle"
      />
    );
  }

  return <PlayableSlidePuzzle key={difficulty} difficulty={difficulty} />;
}
