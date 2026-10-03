import { useState } from "react";
import { useSearchParams } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import {
  hasTsumeShogiProblemQuery,
  parseTsumeShogiProblemQuery,
} from "@/games/tsume-shogi/diagnostics";
import { parseTsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/tsume-shogi/play/:difficulty",
  );
  const [searchParams] = useSearchParams();
  // 問題の指定は人間の遊び比べのための入口で、内部診断が有効なビルドでだけ受け付ける。
  const [specifiedProblem] = useState(() =>
    internalDiagnosticsAvailable && hasTsumeShogiProblemQuery(searchParams)
      ? { problem: parseTsumeShogiProblemQuery(searchParams) }
      : null,
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
  if (specifiedProblem && !specifiedProblem.problem) {
    return (
      <PlayUnavailableNotice
        title="指定された問題を復元できません"
        description="URL の問題指定（pool・problem、または generator・seed・plies・checks・base）を確かめてください。"
        backTo="/puzzles/tsume-shogi"
      />
    );
  }

  return (
    <PlayableTsumeShogi
      key={difficulty}
      difficulty={difficulty}
      initialProblem={
        specifiedProblem?.problem
          ? { problem: specifiedProblem.problem, purpose: "blind-comparison" }
          : undefined
      }
    />
  );
}
