import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { PlayableReflection } from "@/game-catalog/reflection/PlayableReflection";
import {
  hasReflectionProblemQuery,
  parseReflectionProblemQuery,
} from "@/games/reflection/diagnostics";
import { parseReflectionDifficulty } from "@/games/reflection/difficulty";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";

export function ReflectionPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/reflection/play/:difficulty",
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const [searchParams] = useSearchParams();
  // 問題の指定は人間の遊び比べのための入口で、内部診断が有効なビルドでだけ受け付ける。
  const [specifiedProblem] = useState(() =>
    internalDiagnosticsAvailable && hasReflectionProblemQuery(searchParams)
      ? { identity: parseReflectionProblemQuery(searchParams) }
      : null,
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
  if (specifiedProblem && !specifiedProblem.identity) {
    return (
      <PlayUnavailableNotice
        title="指定された問題を復元できません"
        description="URL の問題指定（pool・problem、または generator・seed・size・pieces）を確かめてください。"
        backTo="/puzzles/reflection"
      />
    );
  }

  return (
    <PlayableReflection
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
      blindComparisonProblemIdentity={specifiedProblem?.identity ?? undefined}
    />
  );
}
