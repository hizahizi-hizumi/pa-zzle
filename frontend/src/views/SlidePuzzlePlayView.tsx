import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useParams } from "@/router";
import { PlayableSlidePuzzle } from "@/views/SlidePuzzlePlayView/PlayableSlidePuzzle";

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

  return <PlayableSlidePuzzle difficulty={difficulty} />;
}
