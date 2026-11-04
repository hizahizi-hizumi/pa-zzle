import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import type { HakoiriMusumeResult } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import type { HakoiriMusumePiece } from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import {
  BOX_HEIGHT_CELLS,
  BOX_WIDTH_CELLS,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { HakoiriMusumeBoard } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard";
import { HakoiriMusumeHowToPlayDialog } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog";
import { HakoiriMusumeResultScreen } from "@/games/hakoiri-musume/ui/result/HakoiriMusumeResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type HakoiriMusumePlayProps = GamePlayScreenProps<
  HakoiriMusumeDifficulty,
  HakoiriMusumeResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    pieces: readonly HakoiriMusumePiece[];
    moveCount: number;
    onMovePiece: (
      pieceIndex: number,
      direction: HakoiriMusumeDirection,
    ) => void;
  };

export function HakoiriMusumePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  pieces,
  moveCount,
  canUndo,
  canRestart,
  onMovePiece,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: HakoiriMusumePlayProps) {
  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={HAKOIRI_MUSUME_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HakoiriMusumeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <HakoiriMusumeResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      {/* 画面端から始まるタッチはブラウザの戻る操作に取られるので、盤面の左右に余白を残す。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size] sm:px-6">
        <div
          style={{
            width: `min(100cqw, calc(100cqh * ${BOX_WIDTH_CELLS} / ${BOX_HEIGHT_CELLS}), 30rem)`,
          }}
        >
          <HakoiriMusumeBoard
            pieces={pieces}
            clearing={progress === "clearing"}
            interactionDisabled={progress !== "playing"}
            onMovePiece={onMovePiece}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
