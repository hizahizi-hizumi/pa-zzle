import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { useIceFloorMazePlay } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { IceFloorMazePlay } from "@/games/ice-floor-maze/ui/IceFloorMazePlay";
import { useNavigate } from "@/router";

type PlayableIceFloorMazeProps = {
  difficulty: IceFloorMazeDifficulty;
};

/**
 * 1問のプレイを画面遷移へつなぐ。記録・問題 ID の URL・検証情報にはまだつながない。
 * 難易度選択の画面が無いので、難易度を変える操作はホームへ移す。
 */
export function PlayableIceFloorMaze({
  difficulty,
}: PlayableIceFloorMazeProps) {
  const play = useIceFloorMazePlay(difficulty);
  const navigate = useNavigate();

  function backToHome() {
    navigate("/");
  }

  return (
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
      onChangeDifficulty={backToHome}
      onBackToHome={backToHome}
    />
  );
}
