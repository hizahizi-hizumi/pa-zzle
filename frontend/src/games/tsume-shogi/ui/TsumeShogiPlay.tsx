import { useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type { TsumeShogiOperation } from "@/games/tsume-shogi/play/tsume-shogi-operation";
import type {
  TsumeShogiPlayedMove,
  TsumeShogiResult,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type {
  TsumeShogiBoardPiece,
  TsumeShogiHand as TsumeShogiHandCounts,
  TsumeShogiHandPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import type {
  TsumeShogiPromotionChoice,
  TsumeShogiRejection,
  TsumeShogiSelection,
  TsumeShogiSessionPhase,
} from "@/games/tsume-shogi/session/session";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";
import {
  TsumeShogiBoardGroup,
  tsumeShogiBoardGroupSizeStyle,
} from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import { TsumeShogiGround } from "@/games/tsume-shogi/ui/TsumeShogiGround";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiHand";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { useShortPlayArea } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-short-play-area";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlayStatus";
import { TsumeShogiTutorial } from "@/games/tsume-shogi/ui/TsumeShogiTutorial";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useTsumeShogiSoundEffects } from "@/games/tsume-shogi/ui/use-tsume-shogi-sound-effects";
import { cn } from "@/lib/utils";

type TsumeShogiPlayProps = GamePlayScreenProps<
  TsumeShogiDifficulty,
  TsumeShogiResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    plies: number;
    phase: TsumeShogiSessionPhase;
    playedPlies: number;
    boardPieces: readonly TsumeShogiBoardPiece[];
    attackerHand: TsumeShogiHandCounts;
    shownMoves: readonly TsumeShogiPlayedMove[];
    shownMovesRestored: boolean;
    precedingMoveTo: TsumeShogiSquare | null;
    boardPieceIds: ReadonlyMap<string, string>;
    selection: TsumeShogiSelection | null;
    promotionChoice: TsumeShogiPromotionChoice | null;
    rejection: TsumeShogiRejection | null;
    operation: TsumeShogiOperation | null;
    onSelectSquare: (square: TsumeShogiSquare) => void;
    onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
    onChoosePromotion: (promote: boolean) => void;
    onCancelPromotion: () => void;
    onClearSelection: () => void;
  };

/**
 * 着手させなかった入力ごとの読み上げの key。同じ文でも入力ごとに読み上げ直すよう、入力ごとに要素を作り直す。
 */
const rejectionAnnouncementKeys = new WeakMap<TsumeShogiRejection, number>();
let nextRejectionAnnouncementKey = 0;

function getRejectionAnnouncementKey(rejection: TsumeShogiRejection): number {
  let key = rejectionAnnouncementKeys.get(rejection);
  if (key === undefined) {
    key = nextRejectionAnnouncementKey++;
    rejectionAnnouncementKeys.set(rejection, key);
  }
  return key;
}

export function TsumeShogiPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  plies,
  phase,
  playedPlies,
  boardPieces,
  attackerHand,
  shownMoves,
  shownMovesRestored,
  precedingMoveTo,
  boardPieceIds,
  selection,
  promotionChoice,
  rejection,
  operation,
  canUndo,
  canRestart,
  onSelectSquare,
  onSelectHandPiece,
  onChoosePromotion,
  onCancelPromotion,
  onClearSelection,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenDiagnostics,
}: TsumeShogiPlayProps) {
  const playing = progress === "playing";
  const kingSquare =
    boardPieces.find(
      ({ piece }) => piece.side === "defender" && piece.type === "king",
    )?.square ?? null;
  useTsumeShogiSoundEffects(operation, progress, kingSquare);
  const acceptsInput = playing && phase === "attacker";
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : playing && phase === "defender"
      ? "waiting"
      : "unavailable";
  const playAreaRef = useRef<HTMLElement>(null);
  const boardAreaRef = useRef<HTMLElement>(null);
  const boardGroupRef = useRef<HTMLDivElement>(null);
  const shortPlayArea = useShortPlayArea(boardAreaRef, boardGroupRef);
  const undoButton = <UndoButton disabled={!canUndo} onUndo={onUndo} />;

  useEffect(() => {
    if (!playing) return;

    function handleKeyDown(event: KeyboardEvent): void {
      // 遊び方などのダイアログはプレイ画面の外へ描かれる。そこでの Esc はダイアログを閉じる操作なので、盤の選択には効かせない。
      const { target } = event;
      const targetsPlayArea =
        target === document.body ||
        (target instanceof Node && playAreaRef.current?.contains(target));
      if (
        !targetsPlayArea ||
        event.key !== "Escape" ||
        event.defaultPrevented
      ) {
        return;
      }

      if (promotionChoice) {
        onCancelPromotion();
      } else {
        onClearSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing, promotionChoice, onCancelPromotion, onClearSelection]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
      progress={progress}
      result={result}
      title={TSUME_SHOGI_DISPLAY_NAME}
      background={<TsumeShogiGround />}
      metrics={[
        { type: "problem-fact", text: `${plies}手詰` },
        { type: "count", label: "手数", count: playedPlies, reservedDigits: 1 },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <TsumeShogiHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose }) => (
        <TsumeShogiTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <TsumeShogiResultScreen
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
      <TsumeShogiPieceDefs>
        {/* 他のゲームと同じく、盤を残りの高さの中央に置き、待ったを画面の下の中央に置く。地は盤を置いた座卓の面にする。 */}
        <main
          ref={boardAreaRef}
          className={cn(
            "flex min-h-0 flex-1 items-center justify-center py-1 [container-type:size]",
            tsumeShogiToneClassNames.tableSurface,
          )}
          style={tsumeShogiBoardGroupSizeStyle}
        >
          <TsumeShogiBoardGroup
            ref={boardGroupRef}
            board={
              <TsumeShogiClearAnimation
                active={progress === "clearing"}
                onClearAnimationComplete={onClearAnimationComplete}
              >
                <TsumeShogiBoard
                  boardPieces={boardPieces}
                  boardPieceIds={boardPieceIds}
                  selection={selection}
                  shownMoves={shownMoves}
                  shownMovesRestored={shownMovesRestored}
                  promotionChoice={promotionChoice}
                  rejection={rejection}
                  mated={!playing}
                  interactionDisabled={!acceptsInput}
                  onSelectSquare={onSelectSquare}
                  onChoosePromotion={onChoosePromotion}
                />
              </TsumeShogiClearAnimation>
            }
            hand={
              <TsumeShogiHand
                hand={attackerHand}
                selectedPieceType={
                  selection?.type === "hand" ? selection.pieceType : null
                }
                availability={handAvailability}
                rejection={rejection}
                // 背の低い画面では、待ったの欄を無くして盤に高さを回し、待ったを駒台と同じ行の左の空きに置く。
                leadingAction={shortPlayArea ? undoButton : undefined}
                onSelectHandPiece={onSelectHandPiece}
              />
            }
            status={
              <TsumeShogiPlayStatus
                plies={plies}
                phase={phase}
                shownMoves={shownMoves}
                precedingMoveTo={precedingMoveTo}
              />
            }
          />
          <p aria-live="polite" className="sr-only">
            {rejection && (
              <span key={getRejectionAnnouncementKey(rejection)}>
                指せません
              </span>
            )}
          </p>
        </main>
        {!shortPlayArea && (
          <footer
            className={cn(
              "grid h-28 shrink-0 items-end px-4 pb-2",
              tsumeShogiToneClassNames.tableSurface,
            )}
          >
            <div className="flex h-14 items-center justify-center">
              {undoButton}
            </div>
          </footer>
        )}
      </TsumeShogiPieceDefs>
    </GamePlayFrame>
  );
}
