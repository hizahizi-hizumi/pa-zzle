import { parseNanpureDifficulty } from "@/games/nanpure/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/NanpurePlayView/InvalidDifficulty";
import { PlayableNanpure } from "@/views/NanpurePlayView/PlayableNanpure";

export function NanpurePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/nanpure/play/:difficulty",
  );
  const difficulty = parseNanpureDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableNanpure difficulty={difficulty} />;
}
