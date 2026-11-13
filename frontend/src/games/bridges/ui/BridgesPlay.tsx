import { useEffect, useState } from "react";

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
import type { BridgesCycleDirection } from "@/games/bridges/puzzle/transitions";
import { BridgesGround } from "@/games/bridges/ui/BridgesGround";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesSeparationNotice } from "@/games/bridges/ui/BridgesPlay/BridgesSeparationNotice";
import { BridgesStatusAnnouncement } from "@/games/bridges/ui/BridgesPlay/BridgesStatusAnnouncement";
import { useBridgesSoundEffects } from "@/games/bridges/ui/BridgesPlay/use-bridges-sound-effects";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import { BOARD_SETTLE_DELAY_MS } from "@/games/bridges/ui/board-settle-delay";
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
    separatedGroupCount: number | null;
    undoCount: number;
    edgeNotice: BridgesEdgeNotice | null;
    onCycleEdge: (edge: number, direction?: BridgesCycleDirection) => void;
  };

export function BridgesPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  board,
  bridges,
  islandStatuses,
  separatedGroupCount,
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
  onBackToAppHome,
  onOpenDiagnostics,
}: BridgesPlayProps) {
  useBridgesSoundEffects(edgeNotice, progress, board, bridges);
  // 盤面ごとに待ち直すので、組の数ではなく今の盤面の橋の並びで、続いた盤面かを見分ける。
  const [settledBridges, setSettledBridges] = useState<
    readonly BridgeCount[] | null
  >(null);
  const shownSeparatedGroupCount =
    progress === "playing" && settledBridges === bridges
      ? separatedGroupCount
      : null;

  useEffect(() => {
    if (separatedGroupCount === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettledBridges(bridges),
      BOARD_SETTLE_DELAY_MS,
    );
    return () => {
      window.clearTimeout(timer);
      // 待ったは前の盤面の配列をそのまま戻すので、知らせた盤面へ戻ったときも待ち直すよう、盤面を離れたら忘れる。
      setSettledBridges(null);
    };
  }, [bridges, separatedGroupCount]);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={BRIDGES_DISPLAY_NAME}
      background={<BridgesGround />}
      metrics={[
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
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
      {/* 盤面の絵は外周の島の周りに海の余白を持ち、画面端から始まるタッチ（ブラウザの戻る操作）から島を離すので、左右の余白は狭くてよい。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 [container-type:size] sm:px-6">
        <div className="relative aspect-square w-[min(100cqw,100cqh)]">
          <BridgesBoard
            board={board}
            bridges={bridges}
            islandStatuses={islandStatuses}
            edgeNotice={edgeNotice}
            clearing={progress === "clearing"}
            solved={progress !== "playing"}
            interactionDisabled={progress !== "playing"}
            onCycleEdge={onCycleEdge}
            onCycleEdgeBackward={(edge) => onCycleEdge(edge, "backward")}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
        <BridgesStatusAnnouncement
          board={board}
          notice={edgeNotice}
          solved={progress !== "playing"}
          separatedGroupCount={shownSeparatedGroupCount}
        />
      </main>
      <footer className="grid h-28 shrink-0 content-end px-4 pb-2">
        {/* 一言の有無で待ったのボタンと盤面を動かさないよう、一言の場所を空けておく。 */}
        <div className="flex h-12 items-end justify-center">
          {shownSeparatedGroupCount !== null && (
            <BridgesSeparationNotice groupCount={shownSeparatedGroupCount} />
          )}
        </div>
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
