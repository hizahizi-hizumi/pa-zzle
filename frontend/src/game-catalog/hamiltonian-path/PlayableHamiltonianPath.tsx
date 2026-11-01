import { useGameNavigation } from "@/game-catalog/game-navigation";
import { hamiltonianPathCatalogEntry } from "@/game-catalog/hamiltonian-path/hamiltonian-path-catalog-entry";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { useHamiltonianPathPlay } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import { selectHamiltonianPathProblemById } from "@/games/hamiltonian-path/problem-selection";
import { HamiltonianPathPlay } from "@/games/hamiltonian-path/ui/HamiltonianPathPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableHamiltonianPathProps = {
  difficulty: HamiltonianPathDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

/**
 * 1問のプレイを URL の問題 ID と画面遷移へつなぐ。
 * 評価・記録・検証情報はまだ無いので、完了記録・離脱の記録・検証情報（`usePlayableGame`）にはつながない。
 */
export function PlayableHamiltonianPath({
  difficulty,
  avoidedProblemId,
}: PlayableHamiltonianPathProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectHamiltonianPathProblemById(difficulty, problemId),
  );
  const play = useHamiltonianPathPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  useProblemIdQuerySync(play.problemIdentity);
  const navigation = useGameNavigation(hamiltonianPathCatalogEntry);

  return (
    <HamiltonianPathPlay
      difficulty={difficulty}
      progress={play.progress}
      elapsedMs={play.elapsedMs}
      result={play.result}
      recordOutcomeNotice={null}
      board={play.board}
      path={play.path}
      isDeadEnd={play.isDeadEnd}
      blockedMove={play.blockedMove}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onBeginStroke={play.beginStroke}
      onTraceStroke={play.traceStroke}
      onEndStroke={play.endStroke}
      onMoveHeadToward={play.moveHeadToward}
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
