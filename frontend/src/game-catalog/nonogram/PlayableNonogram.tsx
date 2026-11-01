import { useGameNavigation } from "@/game-catalog/game-navigation";
import { nonogramCatalogEntry } from "@/game-catalog/nonogram/nonogram-catalog-entry";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import { useNonogramPlay } from "@/games/nonogram/play/use-nonogram-play";
import { selectNonogramProblemById } from "@/games/nonogram/problem-selection";
import { NonogramPlay } from "@/games/nonogram/ui/NonogramPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableNonogramProps = {
  difficulty: NonogramDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

/**
 * 1問のプレイを URL の問題 ID と画面遷移へつなぐ。
 * 評価・記録・検証情報が無いので、完了記録・離脱の記録・検証情報（`usePlayableGame`）にはつながない。
 */
export function PlayableNonogram({
  difficulty,
  avoidedProblemId,
}: PlayableNonogramProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectNonogramProblemById(difficulty, problemId),
  );
  const play = useNonogramPlay(difficulty, requestedProblem, avoidedProblemId);
  useProblemIdQuerySync(play.problemIdentity);
  const navigation = useGameNavigation(nonogramCatalogEntry);

  return (
    <NonogramPlay
      difficulty={difficulty}
      progress={play.progress}
      elapsedMs={play.elapsedMs}
      result={play.result}
      recordOutcomeNotice={null}
      board={play.board}
      clues={play.clues}
      matchedLines={play.matchedLines}
      strokeRange={play.strokeRange}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onStartStroke={play.startStroke}
      onExtendStroke={play.extendStroke}
      onEndStroke={play.endStroke}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onClearAnimationComplete={play.completeClearAnimation}
      onStartNewProblem={play.startNewProblem}
      onOpenRecords={navigation.openRecords}
      onChangeDifficulty={navigation.changeDifficulty}
      onBackToHome={navigation.backToHome}
    />
  );
}
