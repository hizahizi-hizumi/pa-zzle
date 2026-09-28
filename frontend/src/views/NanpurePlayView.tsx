import { parseNanpureLegacyDifficulty } from "@/games/nanpure/legacy/difficulty";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/NanpurePlayView/InvalidDifficulty";
import { PlayableNanpure } from "@/views/NanpurePlayView/PlayableNanpure";

export function NanpurePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/nanpure/play/:difficulty",
  );
  const difficulty = parseNanpureLegacyDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  return <PlayableNanpure difficulty={difficulty} />;
}
