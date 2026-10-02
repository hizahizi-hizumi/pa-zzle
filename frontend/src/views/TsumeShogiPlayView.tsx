import { useLocation } from "react-router";

import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import { parseTsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { useParams } from "@/router";
import { TsumeShogiPlayUnavailable } from "@/views/TsumeShogiPlayView/TsumeShogiPlayUnavailable";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/tsume-shogi/play/:difficulty",
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseTsumeShogiDifficulty(difficultyParam);

  if (!difficulty) {
    return <TsumeShogiPlayUnavailable title="この難易度は選べません" />;
  }

  return (
    <PlayableTsumeShogi
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
