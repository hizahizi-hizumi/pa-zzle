import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import reflectionPictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  getReflectionLaserPathPolicy,
  type ReflectionLaserPathMode,
} from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import { getReflectionScoreCriteria } from "@/games/reflection/ui/result/ReflectionResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type ReflectionResultScreenProps = {
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  result: ReflectionResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

function listScoreBreakdown(
  result: ReflectionResult,
  showsCheckCount: boolean,
) {
  const { workload } = result;
  return [
    { label: "盤面戻し", value: `${result.restartCount}回` },
    ...(showsCheckCount
      ? [{ label: "光路の確認", value: `${result.laserCheckCount}回` }]
      : []),
    { label: "基準時間", value: formatElapsedTime(result.speedFullScoreMs) },
    { label: "ピース", value: `${workload.pieceCount}個` },
    { label: "外周ヒント", value: `${workload.clueCount}本` },
    {
      label: "照らし直す局面",
      value: `${workload.propagationRoundCount}回`,
    },
    {
      label: "仮に置いて確かめる",
      value: `${workload.assumptionTestCount}回`,
    },
    {
      label: "試し置き",
      value:
        workload.trialMoveCount === null
          ? "試し置きでは解けない"
          : `${workload.trialMoveCount}手`,
    },
  ];
}

export function ReflectionResultScreen({
  difficultyLabel,
  laserPathMode,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ReflectionResultScreenProps) {
  const { showsCheckCountInResult } =
    getReflectionLaserPathPolicy(laserPathMode);

  return (
    <GameResultScreen
      gameName={REFLECTION_DISPLAY_NAME}
      difficultyLabel={difficultyLabel}
      pictogramSvg={reflectionPictogramSvg}
      metrics={[
        {
          label: "時間",
          value: formatElapsedTime(result.elapsedMs),
          detail: `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`,
        },
        { label: "置き直し", value: String(result.relocationCount) },
      ]}
      score={result.score}
      scoreBreakdown={listScoreBreakdown(result, showsCheckCountInResult)}
      scoreCriteria={getReflectionScoreCriteria(result)}
      recordOutcomeNotice={recordOutcomeNotice}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
