import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import { WATER_SORT_SCORE_MAXIMUMS } from "@/games/water-sort/score";
import { getWaterSortScoreCriteria } from "@/games/water-sort/ui/result/WaterSortResultScreen/score-criteria";
import {
  formatElapsedTime,
  formatElapsedTimeWithTenths,
} from "@/lib/format-elapsed-time";
import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  result: WaterSortResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortResultScreenProps) {
  return (
    <GameResultScreen
      gameName="ウォーターソート"
      difficultyLabel={getWaterSortDifficultyLabel(difficulty)}
      pictogramSvg={waterSortPictogramSvg}
      score={result.score.total}
      metrics={[
        {
          label: "手数",
          value: String(result.completionMoveCount),
          detail: `最短 ${formatCountDelta(result.moveDelta)}`,
        },
        {
          label: "時間",
          value: formatElapsedTime(result.elapsedMs),
          detail: `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`,
        },
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        {
          label: "効率",
          value: `${result.score.breakdown.efficiency} / ${WATER_SORT_SCORE_MAXIMUMS.efficiency}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${WATER_SORT_SCORE_MAXIMUMS.speed}`,
        },
        {
          label: "正確性",
          value: `${result.score.breakdown.accuracy} / ${WATER_SORT_SCORE_MAXIMUMS.accuracy}`,
        },
        {
          label: "基準時間",
          value: formatElapsedTimeWithTenths(result.speedFullScoreMs),
        },
        { label: "総手数", value: String(result.moveCount) },
        { label: "手戻り", value: `${result.backtrackMoveCount}手` },
        { label: "待った", value: `${result.undoCount}回` },
        { label: "やり直し", value: `${result.restartCount}回` },
      ]}
      scoreCriteria={getWaterSortScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
