import {
  type ComponentType,
  useCallback,
  useInsertionEffect,
  useRef,
  useState,
} from "react";
import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import type {
  WaterSortOperation,
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { DeadlockNotice } from "@/games/water-sort/ui/DeadlockNotice";
import { CurrentSoundEffects } from "@/games/water-sort/ui/ideas/CurrentSoundEffects";
import { useWaterSortIdea } from "@/games/water-sort/ui/ideas/IdeaContext";
import { IdeaSwitcher } from "@/games/water-sort/ui/ideas/IdeaSwitcher";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { WaterSortGround } from "@/games/water-sort/ui/WaterSortGround";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { cn } from "@/lib/utils";

export type WaterSortPlayProps = GamePlayScreenProps<
  WaterSortDifficulty,
  WaterSortResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    state: WaterSortState;
    moveCount: number;
    undoCount: number;
    isDeadlocked: boolean;
    sourceBottleIndex: number | null;
    operation: WaterSortOperation | null;
    onSelectBottle: (bottleIndex: number) => void;
  };

export function WaterSortPlayScreen({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  state,
  moveCount,
  undoCount,
  canUndo,
  isDeadlocked,
  sourceBottleIndex,
  operation,
  onSelectBottle,
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
}: WaterSortPlayProps) {
  const [hasActivePourAnimation, setHasActivePourAnimation] = useState(false);
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;
  const { overrides } = useWaterSortIdea();
  const SoundEffects = overrides.SoundEffects ?? CurrentSoundEffects;
  const Ground = overrides.Ground ?? WaterSortGround;
  const BoardBackdrop = overrides.BoardBackdrop;
  // 始めた演出は、途中で案を切り替えても最後まで続け、リセットで手が変わったら外す。
  const [playingFinale, setPlayingFinale] = useState<{
    operationId: number;
    Finale: ComponentType<ClearFinaleProps>;
  } | null>(null);

  // 盤面は受け取った関数が変わると注ぐ演出をやり直すので、経過時間の表示で描き直しても同じ関数を渡す。
  const latestClearHandlingRef = useRef({
    ClearFinale: overrides.ClearFinale,
    operationId: operation?.id,
    onClearAnimationComplete,
  });
  // 動きを減らす設定では盤面が自分の layout effect の中で完了を知らせ、子の layout effect は親より先に走るので、それより前に更新する。
  useInsertionEffect(() => {
    latestClearHandlingRef.current = {
      ClearFinale: overrides.ClearFinale,
      operationId: operation?.id,
      onClearAnimationComplete,
    };
  });
  const handleBoardClearAnimationComplete = useCallback(() => {
    const {
      ClearFinale,
      operationId,
      onClearAnimationComplete: complete,
    } = latestClearHandlingRef.current;
    if (ClearFinale && operationId !== undefined) {
      setPlayingFinale({ operationId, Finale: ClearFinale });
      return;
    }
    complete();
  }, []);

  const frame = (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={WATER_SORT_DISPLAY_NAME}
      background={<Ground />}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
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
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <WaterSortHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose }) => (
        <WaterSortTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <WaterSortResultScreen
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
      <main className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        {BoardBackdrop && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <BoardBackdrop
              state={state}
              getBottleElements={getBoardBottleElements}
            />
          </div>
        )}
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          operation={operation}
          onSelectBottle={onSelectBottle}
          interactionDisabled={progress !== "playing"}
          onPourAnimationActivityChange={setHasActivePourAnimation}
          onClearAnimationComplete={handleBoardClearAnimationComplete}
        />
        {playingFinale &&
          progress === "clearing" &&
          playingFinale.operationId === operation?.id && (
            <playingFinale.Finale
              state={state}
              getBottleElements={getBoardBottleElements}
              onDone={() => {
                setPlayingFinale(null);
                onClearAnimationComplete();
              }}
            />
          )}
      </main>
      <SoundEffects operation={operation} progress={progress} />
      <footer className="relative grid h-28 shrink-0 items-end px-4 pb-2">
        {progress === "playing" && <IdeaSwitcher />}
        {showDeadlockNotice ? (
          <DeadlockNotice
            canUndo={canUndo}
            onUndo={onUndo}
            onRestart={onRestart}
          />
        ) : (
          <div className="flex h-14 items-center justify-center">
            <UndoButton disabled={!canUndo} onUndo={onUndo} />
          </div>
        )}
      </footer>
    </GamePlayFrame>
  );

  // 世界の明暗はプレイ画面にだけ効かせ、結果画面はアプリの明暗のまま見せる。
  // 世界を切り替えても盤面を作り直さないよう、包みは常に置いてクラスだけを替える。
  const playsInDark = overrides.colorScheme === "dark" && progress !== "result";
  return (
    <div className={cn("contents", playsInDark && "dark text-foreground")}>
      {frame}
    </div>
  );
}

function getBoardBottleElements(): readonly HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-water-sort-board] > button"),
  );
}
