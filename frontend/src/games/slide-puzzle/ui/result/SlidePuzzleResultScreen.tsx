import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import slidePuzzlePictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import {
  getSlidePuzzleDifficultyLabel,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { SLIDE_PUZZLE_SCORE_MAXIMUMS } from "@/games/slide-puzzle/score";
import { getSlidePuzzleScoreCriteria } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen/score-criteria";
import {
  formatElapsedTime,
  formatElapsedTimeWithTenths,
} from "@/lib/format-elapsed-time";
import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";

type SlidePuzzleResultScreenProps = {
  difficulty: SlidePuzzleDifficulty;
  result: SlidePuzzleResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function SlidePuzzleResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: SlidePuzzleResultScreenProps) {
  return (
    <GameResultScreen
      gameName="スライドパズル"
      difficultyLabel={getSlidePuzzleDifficultyLabel(difficulty)}
      pictogramSvg={slidePuzzlePictogramSvg}
      score={result.score.total}
      metrics={[
        {
          label: "手数",
          value: String(result.moveCount),
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
          value: `${result.score.breakdown.efficiency} / ${SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${SLIDE_PUZZLE_SCORE_MAXIMUMS.speed}`,
        },
        { label: "最短手数", value: `${result.optimalMoveCount}手` },
        {
          label: "基準時間",
          value: formatElapsedTimeWithTenths(result.speedFullScoreMs),
        },
        { label: "完成時の手数", value: `${result.completionMoveCount}手` },
        { label: "盤面を戻す", value: `${result.restartCount}回` },
        { label: "スライド操作", value: `${result.slideCount}回` },
      ]}
      scoreCriteria={getSlidePuzzleScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
