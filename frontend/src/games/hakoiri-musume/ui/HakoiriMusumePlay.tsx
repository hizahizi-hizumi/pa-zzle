import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import type {
  HakoiriMusumeResult,
  HakoiriMusumeStepNotice,
} from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import type { HakoiriMusumePiece } from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import {
  BOX_HEIGHT_CELLS,
  BOX_WIDTH_CELLS,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { HakoiriMusumeBoard } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard";
import { HakoiriMusumeHowToPlayDialog } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog";
import { useHakoiriMusumeSoundEffects } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay/use-hakoiri-musume-sound-effects";
import { HakoiriMusumeTutorial } from "@/games/hakoiri-musume/ui/HakoiriMusumeTutorial";
import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";
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
    stepNotice: HakoiriMusumeStepNotice | null;
    onMovePiece: (
      pieceIndex: number,
      directions: readonly HakoiriMusumeDirection[],
    ) => void;
  };

export function HakoiriMusumePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  pieces,
  moveCount,
  stepNotice,
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
  useHakoiriMusumeSoundEffects(stepNotice, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={HAKOIRI_MUSUME_DISPLAY_NAME}
      background={
        <div
          className={`size-full ${hakoiriMusumeToneClassNames.tableSurface}`}
        />
      }
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
      renderTutorial={({ open, onClose }) => (
        <HakoiriMusumeTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <HakoiriMusumeResultScreen
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
      {/* 低い画面（横向きのスマホ）では、待ったの列を盤面の右へ置き、盤面に高さを譲る。縦の画面では盤面の下に置く。 */}
      <div className="flex min-h-0 flex-1 flex-col [@media(max-height:30rem)]:flex-row">
        {/* 画面端から始まるタッチはブラウザの戻る操作に取られるので、盤面の左右に余白を残す。 */}
        {/* 長い辺（縦）の上限は、ほかのゲームの盤面の長い辺と同じ 44rem にそろえる。 */}
        <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size] sm:px-6">
          <div
            style={{
              width: `min(100cqw, min(100cqh, 44rem) * ${BOX_WIDTH_CELLS} / ${BOX_HEIGHT_CELLS})`,
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
        <footer className="grid h-28 shrink-0 items-end px-4 pb-2 [@media(max-height:30rem)]:h-auto [@media(max-height:30rem)]:items-center [@media(max-height:30rem)]:pb-0">
          <div className="flex h-14 items-center justify-center">
            <UndoButton disabled={!canUndo} onUndo={onUndo} />
          </div>
        </footer>
      </div>
    </GamePlayFrame>
  );
}
