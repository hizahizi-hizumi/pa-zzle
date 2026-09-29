import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { parseTakuzuDifficulty } from "@/games/takuzu/difficulty";
import { useParams } from "@/router";
import { PlayableTakuzu } from "@/views/TakuzuPlayView/PlayableTakuzu";

export function TakuzuPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/takuzu/play/:difficulty",
  );
  const difficulty = parseTakuzuDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/takuzu"
      />
    );
  }

  return <PlayableTakuzu key={difficulty} difficulty={difficulty} />;
}
