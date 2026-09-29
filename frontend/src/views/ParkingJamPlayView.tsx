import { useState } from "react";
import { useSearchParams } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import {
  hasParkingJamProblemQuery,
  parseParkingJamProblemQuery,
} from "@/games/parking-jam/diagnostics";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/ParkingJamPlayView/InvalidDifficulty";
import { PlayableParkingJam } from "@/views/ParkingJamPlayView/PlayableParkingJam";

export function ParkingJamPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/parking-jam/play/:difficulty",
  );
  const [searchParams] = useSearchParams();
  // 問題の指定は人間の遊び比べのための入口で、内部診断が有効なビルドでだけ受け付ける。
  const [specifiedProblem] = useState(() =>
    internalDiagnosticsAvailable && hasParkingJamProblemQuery(searchParams)
      ? { identity: parseParkingJamProblemQuery(searchParams) }
      : null,
  );
  const difficulty = parseParkingJamDifficulty(difficultyParam);

  if (!difficulty) return <InvalidDifficulty />;
  if (specifiedProblem && !specifiedProblem.identity) {
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
      difficulty={difficulty}
      initialProblem={
        specifiedProblem?.identity
          ? { identity: specifiedProblem.identity, purpose: "blind-comparison" }
          : undefined
      }
    />
  );
}
