import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import { getDifficultyLabel } from "@/games/difficulty";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import { NANPURE_SCORE_MAXIMUMS } from "@/games/nanpure/score";
import { nanpureScoreCriteria } from "@/games/nanpure/ui/result/NanpureResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type NanpureResultScreenProps = {
  difficulty: NanpureDifficulty;
  result: NanpureResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function NanpureResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: NanpureResultScreenProps) {
  return (
    <GameResultScreen
      gameName="ナンプレ"
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={nanpurePictogramSvg}
      score={result.score.total}
      metrics={[
        { label: "時間", value: formatElapsedTime(result.elapsedMs) },
        { label: "ミス", value: String(result.mistakeCount) },
        { label: "待った", value: String(result.undoCount) },
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        {
          label: "正確さ",
          value: `${result.score.breakdown.accuracy} / ${NANPURE_SCORE_MAXIMUMS.accuracy}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${NANPURE_SCORE_MAXIMUMS.speed}`,
        },
        {
          label: "安定性",
          value: `${result.score.breakdown.stability} / ${NANPURE_SCORE_MAXIMUMS.stability}`,
        },
        { label: "やり直し", value: `${result.restartCount}回` },
      ]}
      scoreCriteria={nanpureScoreCriteria}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
