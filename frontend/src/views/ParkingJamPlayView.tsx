import { useState } from "react";
import { useSearchParams } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import {
  hasParkingJamProblemQuery,
  parseParkingJamProblemQuery,
} from "@/games/parking-jam/diagnostics";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblemWithoutAnalysis } from "@/games/parking-jam/problem/generator";
import { restoreProblemOrNull } from "@/games/problem-restoration";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";

function restoreSpecifiedProblem(searchParams: URLSearchParams) {
  const identity = parseParkingJamProblemQuery(searchParams);
  return {
    restored: identity
      ? restoreProblemOrNull(() =>
          restoreParkingJamProblemWithoutAnalysis(identity),
        )
      : null,
  };
}

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/parking-jam/play/:difficulty",
  );
  const [searchParams] = useSearchParams();
  // 問題の指定は人間の遊び比べのための入口で、内部診断が有効なビルドでだけ受け付ける。
  const [specifiedProblem] = useState(() =>
    internalDiagnosticsAvailable && hasParkingJamProblemQuery(searchParams)
      ? restoreSpecifiedProblem(searchParams)
      : null,
  );
  const difficulty = parseParkingJamDifficulty(difficultyParam);

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo="/puzzles/parking-jam"
      />
    );
  }
  if (specifiedProblem && !specifiedProblem.restored) {
    return (
      <PlayUnavailableNotice
        title="指定された問題を復元できません"
        description="URL の問題指定（seed・生成条件・生成試行）を確かめてください。"
        backTo="/puzzles/parking-jam"
      />
    );
  }

  return (
    <PlayableParkingJam
      key={difficulty}
      difficulty={difficulty}
      initialProblem={
        specifiedProblem?.restored
          ? { restored: specifiedProblem.restored, purpose: "blind-comparison" }
          : undefined
      }
    />
  );
}
