import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableNanpure } from "@/game-catalog/nanpure/PlayableNanpure";
import { parseNanpureDifficulty } from "@/games/nanpure/difficulty";
import { useParams } from "@/router";

export function NanpurePlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/nanpure/play/:difficulty",
  );
  const difficulty = parseNanpureDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/nanpure"
      />
    );
  }

  return <PlayableNanpure key={difficulty} difficulty={difficulty} />;
}
