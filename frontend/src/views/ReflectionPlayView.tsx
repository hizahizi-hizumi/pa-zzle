import { useState } from "react";
import { useSearchParams } from "react-router";

import {
  hasReflectionProblemQuery,
  parseReflectionProblemQuery,
} from "@/games/reflection/diagnostics";
import { parseReflectionDifficulty } from "@/games/reflection/difficulty";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/ReflectionPlayView/InvalidDifficulty";
import { InvalidProblemQuery } from "@/views/ReflectionPlayView/InvalidProblemQuery";
import { PlayableReflection } from "@/views/ReflectionPlayView/PlayableReflection";

export function ReflectionPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/reflection/play/:difficulty",
  );
  const [searchParams] = useSearchParams();
  // 問題の指定は人間の遊び比べのための入口で、内部診断が有効なビルドでだけ受け付ける。
  const [specifiedProblem] = useState(() =>
    internalDiagnosticsAvailable && hasReflectionProblemQuery(searchParams)
      ? { identity: parseReflectionProblemQuery(searchParams) }
      : null,
  );
  const difficulty = parseReflectionDifficulty(difficultyParam);

  if (!difficulty) return <InvalidDifficulty />;
  if (specifiedProblem && !specifiedProblem.identity) {
    return <InvalidProblemQuery />;
  }

  return (
    <PlayableReflection
      key={difficulty}
      difficulty={difficulty}
      initialProblem={
        specifiedProblem?.identity
          ? { identity: specifiedProblem.identity, purpose: "blind-comparison" }
          : undefined
      }
    />
  );
}
