import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import tsumeShogiPictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TSUME_SHOGI_SCORE_MAXIMUMS } from "@/games/tsume-shogi/score";
import type { TsumeShogiSessionResult } from "@/games/tsume-shogi/session/session";
import { getTsumeShogiScoreCriteria } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type TsumeShogiResultScreenProps = {
  /** 結果に出す難易度の表示名。問題を指定したプレイでは難易度を伏せた名前を渡す。 */
  difficultyLabel: string;
  /** そのプレイで起きた事実。 */
  performance: TsumeShogiSessionResult;
  /** 事実と問題の作業の量から導いた評価。 */
  result: TsumeShogiResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

function listScoreBreakdown(result: TsumeShogiResult) {
  const { score, workload } = result;
  return [
    {
      label: "読みの確かさ",
      value: `${score.breakdown.accuracy} / ${TSUME_SHOGI_SCORE_MAXIMUMS.accuracy}`,
    },
    {
      label: "速さ",
      value: `${score.breakdown.speed} / ${TSUME_SHOGI_SCORE_MAXIMUMS.speed}`,
    },
    { label: "反証を見た", value: `${result.refutationViewCount}回` },
    { label: "待った", value: `${result.undoCount}回` },
    { label: "盤面戻し", value: `${result.restartCount}回` },
    { label: "基準時間", value: formatElapsedTime(result.speedFullScoreMs) },
    { label: "手数", value: `${workload.plies}手詰` },
    { label: "初手の王手", value: `${workload.rootChecks}個` },
    { label: "効いていそうな誤王手", value: `${workload.plausibleWrong}個` },
    { label: "数手先まで続く紛れ", value: `${workload.deepDecoyCount}個` },
  ];
}

export function TsumeShogiResultScreen({
  difficultyLabel,
  performance,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TsumeShogiResultScreenProps) {
  const common = {
    gameName: TSUME_SHOGI_DISPLAY_NAME,
    difficultyLabel,
    pictogramSvg: tsumeShogiPictogramSvg,
    metrics: [
      {
        label: "時間",
        value: formatElapsedTime(performance.elapsedMs),
        detail: `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`,
      },
      { label: "誤王手", value: String(performance.wrongCheckCount) },
    ],
    recordOutcomeNotice,
    onStartNewProblem,
    onReplay,
    onOpenRecords,
    onChangeDifficulty,
    onBackToHome,
    onOpenDiagnostics,
  } as const;

  return (
    <GameResultScreen
      {...common}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getTsumeShogiScoreCriteria(result)}
    />
  );
}
