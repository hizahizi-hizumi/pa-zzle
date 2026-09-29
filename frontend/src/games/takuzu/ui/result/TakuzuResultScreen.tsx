import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import takuzuPictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import {
  getTakuzuDifficultyLabel,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import { TAKUZU_SCORE_MAXIMUMS } from "@/games/takuzu/score";
import { getTakuzuScoreCriteria } from "@/games/takuzu/ui/result/TakuzuResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type TakuzuResultScreenProps = {
  difficulty: TakuzuDifficulty;
  result: TakuzuResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuResultScreenProps) {
  return (
    <GameResultScreen
      gameName="バイナリパズル"
      difficultyLabel={getTakuzuDifficultyLabel(difficulty)}
      pictogramSvg={takuzuPictogramSvg}
      score={result.score.total}
      metrics={[
        {
          label: "時間",
          value: formatElapsedTime(result.elapsedMs),
          detail: `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`,
        },
        { label: "置き直し", value: String(result.correctionCount) },
        { label: "待った", value: String(result.undoCount) },
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        {
          label: "正確性",
          value: `${result.score.breakdown.accuracy} / ${TAKUZU_SCORE_MAXIMUMS.accuracy}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${TAKUZU_SCORE_MAXIMUMS.speed}`,
        },
        { label: "盤面戻し", value: `${result.restartCount}回` },
        {
          label: "基準時間",
          value: formatElapsedTime(result.speedFullScoreMs),
        },
        {
          label: "空きマス",
          value: `${result.workload.emptyCellCount}マス`,
        },
        {
          label: "確定マスを探す局面",
          value: `${result.workload.roundCount}回`,
        },
        {
          label: "行・列を読む局面",
          value: `${result.workload.lineReadingRoundCount}回`,
        },
      ]}
      scoreCriteria={getTakuzuScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
