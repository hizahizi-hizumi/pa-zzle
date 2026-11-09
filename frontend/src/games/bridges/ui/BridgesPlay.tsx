import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import type {
  BridgesEdgeNotice,
  BridgesResult,
} from "@/games/bridges/play/use-bridges-play";
import type { BridgesBoard as BridgesBoardState } from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesStatusAnnouncement } from "@/games/bridges/ui/BridgesPlay/BridgesStatusAnnouncement";
import { useBridgesSoundEffects } from "@/games/bridges/ui/BridgesPlay/use-bridges-sound-effects";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import { BridgesResultScreen } from "@/games/bridges/ui/result/BridgesResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type BridgesPlayProps = GamePlayScreenProps<BridgesDifficulty, BridgesResult> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: BridgesBoardState;
    bridges: readonly BridgeCount[];
    islandStatuses: readonly BridgesIslandStatus[];
    undoCount: number;
    edgeNotice: BridgesEdgeNotice | null;
    onCycleEdge: (edge: number) => void;
  };

/** 1問のプレイ画面。クリアの演出を終えると結果画面に替わる。 */
export function BridgesPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  board,
  bridges,
  islandStatuses,
  undoCount,
  edgeNotice,
  canUndo,
  canRestart,
  onCycleEdge,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: BridgesPlayProps) {
  useBridgesSoundEffects(edgeNotice, progress, board, bridges);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={BRIDGES_DISPLAY_NAME}
      // ライトは島の盤を囲む海に見立てたくすんだ青緑の地にする。ダークは盤面の暖色の地と色相をそろえ、盤面より一段暗い灰にする。
      background={<div className="size-full bg-[#dfe7e6] dark:bg-[#1c1a18]" />}
      metrics={[
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <BridgesHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose }) => (
        <BridgesTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <BridgesResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      {/* 画面端から始まるタッチはブラウザの戻る操作に取られるので、盤面の左右に余白を残す。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size] sm:px-6">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <BridgesBoard
            board={board}
            bridges={bridges}
            islandStatuses={islandStatuses}
            edgeNotice={edgeNotice}
            clearing={progress === "clearing"}
            interactionDisabled={progress !== "playing"}
            onCycleEdge={onCycleEdge}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
        <BridgesStatusAnnouncement
          board={board}
          notice={edgeNotice}
          solved={progress !== "playing"}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
