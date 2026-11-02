import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { useGameNavigation } from "@/game-catalog/game-navigation";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import { useBridgesPlay } from "@/games/bridges/play/use-bridges-play";
import { selectBridgesProblemById } from "@/games/bridges/problem-selection";
import { BridgesPlay } from "@/games/bridges/ui/BridgesPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableBridgesProps = {
  difficulty: BridgesDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

/**
 * 1問のプレイを URL の問題 ID と画面遷移へつなぐ。
 * 評価・記録・検証情報を持たないので、完了記録・離脱の記録・検証情報（`usePlayableGame`）にはつながない。
 */
export function PlayableBridges({
  difficulty,
  avoidedProblemId,
}: PlayableBridgesProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectBridgesProblemById(difficulty, problemId),
  );
  const play = useBridgesPlay(difficulty, requestedProblem, avoidedProblemId);
  useProblemIdQuerySync(play.problemIdentity);
  const navigation = useGameNavigation(bridgesCatalogEntry);

  return (
    <BridgesPlay
      difficulty={difficulty}
      progress={play.progress}
      elapsedMs={play.elapsedMs}
      result={play.result}
      recordOutcomeNotice={null}
      board={play.board}
      bridges={play.bridges}
      islandStatuses={play.islandStatuses}
      undoCount={play.undoCount}
      edgeNotice={play.edgeNotice}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onCycleEdge={play.cycleEdge}
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
