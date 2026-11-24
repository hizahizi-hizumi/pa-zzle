import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import type {
  FukumenzanCrossUndoNotice,
  FukumenzanResult,
} from "@/games/fukumenzan/play/use-fukumenzan-play";
import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";
import { FukumenzanCardRow } from "@/games/fukumenzan/ui/board/FukumenzanCardRow";
import { FukumenzanDraggedCard } from "@/games/fukumenzan/ui/board/FukumenzanDraggedCard";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import { useFukumenzanInput } from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";
import { FukumenzanHowToPlayDialog } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog";
import { FukumenzanResultScreen } from "@/games/fukumenzan/ui/result/FukumenzanResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type FukumenzanPlayProps = GamePlayScreenProps<
  FukumenzanDifficulty,
  FukumenzanResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    problem: FukumenzanProblem;
    letters: readonly string[];
    puzzleState: FukumenzanPuzzleState;
    leadingZeroLetters: readonly number[];
    miscalculatedColumns: readonly number[];
    undoCount: number;
    crossUndoNotice: FukumenzanCrossUndoNotice | null;
    onPlaceDigit: (letter: number, digit: FukumenzanDigit) => void;
    onReturnDigit: (letter: number) => void;
    onToggleCross: (letter: number, digit: FukumenzanDigit) => void;
  };

export function FukumenzanPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  problem,
  letters,
  puzzleState,
  leadingZeroLetters,
  miscalculatedColumns,
  undoCount,
  crossUndoNotice,
  canUndo,
  canRestart,
  onPlaceDigit,
  onReturnDigit,
  onToggleCross,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
  renderSettingsDialog,
}: FukumenzanPlayProps) {
  const interactionDisabled = progress !== "playing";
  const input = useFukumenzanInput({
    puzzleState,
    crossUndoNotice,
    interactionDisabled,
    onPlaceDigit,
    onReturnDigit,
    onToggleCross,
  });

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={FUKUMENZAN_DISPLAY_NAME}
      background={<FukumenzanGround />}
      metrics={[
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      // onReplay は渡さない。やり直しは待ったと盤面を戻すにし、点に入る事実を数え直すリセットはプレイ中に出さない。
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenTutorial={onOpenTutorial}
      onOpenDiagnostics={onOpenDiagnostics}
      renderSettingsDialog={renderSettingsDialog}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <FukumenzanHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderResultScreen={(clearedResult) => (
        <FukumenzanResultScreen
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
      {/* 式は画面端から始まるタッチ（ブラウザの戻る操作）と重ならないよう、左右に余白を取る。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4 [container-type:size]">
        <FukumenzanEquationBoard
          problem={problem}
          letters={letters}
          puzzleState={puzzleState}
          leadingZeroLetters={leadingZeroLetters}
          miscalculatedColumns={miscalculatedColumns}
          selection={input.selection}
          drag={input.drag}
          clearing={progress === "clearing"}
          interactionDisabled={interactionDisabled}
          getLetterHandlers={input.getLetterHandlers}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
      <footer className="mx-auto grid w-full max-w-sm shrink-0 gap-2 px-3 pb-2 sm:max-w-3xl">
        <FukumenzanCardRow
          puzzleState={puzzleState}
          selection={input.selection}
          drag={input.drag}
          interactionDisabled={interactionDisabled}
          getCardHandlers={input.getCardHandlers}
          getEmptySlotHandlers={input.getEmptySlotHandlers}
        />
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
      {input.drag && <FukumenzanDraggedCard drag={input.drag} />}
    </GamePlayFrame>
  );
}
