import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import reflectionPictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  getReflectionLaserPathPolicy,
  type ReflectionLaserPathMode,
} from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionSessionResult } from "@/games/reflection/session/session";
import { getReflectionScoreCriteria } from "@/games/reflection/ui/result/ReflectionResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type ReflectionResultScreenProps = {
  /** 結果に出す難易度の表示名。問題を指定したプレイでは難易度を伏せた名前を渡す。 */
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  /** そのプレイで起きた事実。 */
  performance: ReflectionSessionResult;
  /** 事実と問題の作業の量から導いた評価。問題集に無い問題を指定したプレイでは作業の量が無く、`null`。 */
  result: ReflectionResult | null;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
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
  performance,
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
  const common = {
    gameName: REFLECTION_DISPLAY_NAME,
    difficultyLabel,
    pictogramSvg: reflectionPictogramSvg,
    metrics: [
      {
        label: "時間",
        value: formatElapsedTime(performance.elapsedMs),
        detail: result
          ? `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`
          : undefined,
      },
      { label: "置き直し", value: String(performance.relocationCount) },
    ],
    recordOutcomeNotice,
    onStartNewProblem,
    onReplay,
    onOpenRecords,
    onChangeDifficulty,
    onBackToHome,
    onOpenDiagnostics,
  } as const;

  return result ? (
    <GameResultScreen
      {...common}
      score={result.score}
      scoreBreakdown={listScoreBreakdown(result, showsCheckCountInResult)}
      scoreCriteria={getReflectionScoreCriteria(result)}
    />
  ) : (
    <GameResultScreen
      {...common}
      score={null}
      unscoredReason="問題集に無い問題のため、スコアは出しません。"
    />
  );
}
