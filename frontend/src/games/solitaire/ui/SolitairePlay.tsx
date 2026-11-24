import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import type {
  SolitaireOperation,
  SolitaireResult,
} from "@/games/solitaire/play/use-solitaire-play";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import type { SolitaireState } from "@/games/solitaire/puzzle/state";
import { SolitaireBoard } from "@/games/solitaire/ui/board/SolitaireBoard";
import { SolitaireResultScreen } from "@/games/solitaire/ui/result/SolitaireResultScreen";
import { SolitaireGround } from "@/games/solitaire/ui/SolitaireGround";
import { SolitaireHowToPlayDialog } from "@/games/solitaire/ui/SolitaireHowToPlayDialog";
import { SolitaireStuckNotice } from "@/games/solitaire/ui/SolitairePlay/SolitaireStuckNotice";

type SolitairePlayProps = GamePlayScreenProps<
  SolitaireDifficulty,
  SolitaireResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    state: SolitaireState;
    undoCount: number;
    selectedSource: SolitaireSource | null;
    operation: SolitaireOperation | null;
    isStuck: boolean;
    onSelectPile: (pile: SolitairePile) => void;
  };

export function SolitairePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  state,
  undoCount,
  selectedSource,
  operation,
  isStuck,
  onSelectPile,
  canUndo,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
  renderSettingsDialog,
}: SolitairePlayProps) {
  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={SOLITAIRE_DISPLAY_NAME}
      background={<SolitaireGround />}
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
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenTutorial={onOpenTutorial}
      onOpenDiagnostics={onOpenDiagnostics}
      renderSettingsDialog={renderSettingsDialog}
      renderHowToPlayDialog={({ open, onClose }) => (
        <SolitaireHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <SolitaireResultScreen
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
      {/* 盤面は寸法を自分で測って札の大きさを決めるので、余白は盤面の側で取る。 */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
        <SolitaireBoard
          state={state}
          selectedSource={selectedSource}
          operation={operation}
          interactionDisabled={progress !== "playing"}
          onSelectPile={onSelectPile}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
      {/* 待ったの丸は知らせの有無に関わらず帯の中央に置き、知らせはその左に出す。 */}
      <footer className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 pb-2">
        <div className="flex justify-end">
          {isStuck && <SolitaireStuckNotice />}
        </div>
        <UndoButton disabled={!canUndo} onUndo={onUndo} />
      </footer>
    </GamePlayFrame>
  );
}
