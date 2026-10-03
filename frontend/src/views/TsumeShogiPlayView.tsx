import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import { parseTsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { useParams } from "@/router";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/tsume-shogi/play/:difficulty",
  );
  const difficulty = parseTsumeShogiDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/tsume-shogi"
      />
    );
  }

  return <PlayableTsumeShogi key={difficulty} difficulty={difficulty} />;
}
