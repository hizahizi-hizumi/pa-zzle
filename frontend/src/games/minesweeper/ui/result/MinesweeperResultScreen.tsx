import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import minesweeperPictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import {
  getMinesweeperDifficultyLabel,
  type MinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import { MINESWEEPER_SCORE_MAXIMUMS } from "@/games/minesweeper/score";
import { getMinesweeperScoreCriteria } from "@/games/minesweeper/ui/result/MinesweeperResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";

type MinesweeperResultScreenProps = {
  difficulty: MinesweeperDifficulty;
  result: MinesweeperResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function MinesweeperResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: MinesweeperResultScreenProps) {
  return (
    <GameResultScreen
      gameName="マインスイーパー"
      difficultyLabel={getMinesweeperDifficultyLabel(difficulty)}
      pictogramSvg={minesweeperPictogramSvg}
      score={result.score.total}
      metrics={[
        {
          label: "時間",
          value: formatElapsedTime(result.elapsedMs),
          detail: `基準 ${formatElapsedTimeDelta(result.timeDeltaMs)}`,
        },
        { label: "ミス", value: String(result.mistakeCount) },
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        {
          label: "正確性",
          value: `${result.score.breakdown.accuracy} / ${MINESWEEPER_SCORE_MAXIMUMS.accuracy}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${MINESWEEPER_SCORE_MAXIMUMS.speed}`,
        },
        {
          label: "基準時間",
          value: formatElapsedTime(result.speedFullScoreMs),
        },
        { label: "地雷", value: `${result.mineCount}個` },
        {
          label: "開く操作の最小回数",
          value: `${result.minimumOpenCount}回`,
        },
      ]}
      scoreCriteria={getMinesweeperScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
