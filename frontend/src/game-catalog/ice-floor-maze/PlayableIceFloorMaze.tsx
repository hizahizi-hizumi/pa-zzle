import { useGameNavigation } from "@/game-catalog/game-navigation";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { useInternalDiagnosticsDialog } from "@/game-catalog/internal-diagnostics-dialog";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { createIceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { useIceFloorMazePlay } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { selectIceFloorMazeProblemById } from "@/games/ice-floor-maze/problem-selection";
import { IceFloorMazeDiagnostics } from "@/games/ice-floor-maze/ui/IceFloorMazeDiagnostics";
import { IceFloorMazePlay } from "@/games/ice-floor-maze/ui/IceFloorMazePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableIceFloorMazeProps = {
  difficulty: IceFloorMazeDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

/**
 * 1問のプレイを、URL の問題 ID・画面遷移・検証情報へつなぐ。
 * 記録の定義と結果画面が無いので `usePlayableGame` は使わず、完了記録・離脱の記録・記録の結果画面へはまだつながない。
 */
export function PlayableIceFloorMaze({
  difficulty,
  avoidedProblemId,
}: PlayableIceFloorMazeProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectIceFloorMazeProblemById(difficulty, problemId),
  );
  const play = useIceFloorMazePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  useProblemIdQuerySync(play.problemIdentity);
  const navigation = useGameNavigation(iceFloorMazeCatalogEntry);
  const diagnostics = useInternalDiagnosticsDialog((buildRevision) =>
    createIceFloorMazeDiagnosticSnapshot({
      difficulty,
      problemIdentity: play.problemIdentity,
      buildRevision,
    }),
  );

  return (
    <>
      <IceFloorMazePlay
        progress={play.progress}
        elapsedMs={play.elapsedMs}
        board={play.board}
        goal={play.goal}
        position={play.position}
        moveCount={play.moveCount}
        isTrapped={play.isTrapped}
        operation={play.operation}
        onSlide={play.slide}
        canUndo={play.canUndo}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onClearAnimationComplete={play.completeClearAnimation}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
        onOpenDiagnostics={diagnostics.open}
      />
      {diagnostics.snapshot && (
        <IceFloorMazeDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
