import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableReflection } from "@/game-catalog/reflection/PlayableReflection";
import { parseReflectionDifficulty } from "@/games/reflection/difficulty";
import { useParams } from "@/router";

export function ReflectionPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/reflection/play/:difficulty",
  );
  const difficulty = parseReflectionDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/reflection"
      />
    );
  }

  return <PlayableReflection key={difficulty} difficulty={difficulty} />;
}
