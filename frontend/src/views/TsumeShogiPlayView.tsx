import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useParams } from "@/router";
import { TsumeShogiPlayUnavailable } from "@/views/TsumeShogiPlayView/TsumeShogiPlayUnavailable";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/tsume-shogi/play/:difficulty",
  );
  const difficulty = parseDifficultyLevel(difficultyParam);

  if (!difficulty) {
    return <TsumeShogiPlayUnavailable title="この難易度は選べません" />;
  }

  return <PlayableTsumeShogi key={difficulty} difficulty={difficulty} />;
}
