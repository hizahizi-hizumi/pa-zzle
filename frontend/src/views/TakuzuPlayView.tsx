import { parseTakuzuDifficulty } from "@/games/takuzu/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/TakuzuPlayView/InvalidDifficulty";
import { PlayableTakuzu } from "@/views/TakuzuPlayView/PlayableTakuzu";

export function TakuzuPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/takuzu/play/:difficulty",
  );
  const difficulty = parseTakuzuDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableTakuzu key={difficulty} difficulty={difficulty} />;
}
