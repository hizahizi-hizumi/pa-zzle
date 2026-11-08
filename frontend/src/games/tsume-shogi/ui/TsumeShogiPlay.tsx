import { type CSSProperties, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
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
import {
  TsumeShogiBoard,
  tsumeShogiBoardFrameStyle,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import {
  type TsumeShogiExperience,
  TsumeShogiExperienceComparison,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiExperienceComparison";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPlayStatus";
import { useShortPlayArea } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-short-play-area";
import { useTsumeShogiPieceDrag } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-tsume-shogi-piece-drag";
import { useTsumeShogiSoundEffects } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-tsume-shogi-sound-effects";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiPlayProps = GamePlayScreenProps<
  TsumeShogiDifficulty,
  TsumeShogiResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    plies: number;
    phase: TsumeShogiSessionPhase;
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
    onDragBoardPiece: (from: TsumeShogiSquare, to: TsumeShogiSquare) => void;
    onDragHandPiece: (
      pieceType: TsumeShogiHandPieceType,
      to: TsumeShogiSquare,
    ) => void;
    onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
    onChoosePromotion: (promote: boolean) => void;
    onCancelPromotion: () => void;
    onClearSelection: () => void;
  };

/**
 * 盤の幅。盤の木の縁（`tsumeShogiBoardFrameStyle`）を含め、升は実物の盤と同じ縦長（横 35.2 : 縦 38.6）。
 * 盤の上下に玉方の駒箱の札・攻方の駒台（`--piece-box-height`・`--komadai-height`）、その下に直前の手（1.25rem）を置き、
 * 隙間を除いた高さと、左右の余白（`--board-gutter`）を除いた幅のどちらにも収まる大きさにする。PC では 40rem まで広げる。
 */
const boardSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--board-chrome":
    "calc(var(--piece-box-height) + var(--komadai-height) + 1.25rem + 3 * 0.25rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - var(--board-chrome) - 2 * var(--board-frame)) * 352 / 386 + 2 * var(--board-frame)), 40rem)",
} as CSSProperties;

// 試作では現行の榧盤・座卓の質感を変えず、読める情報と手の応酬を比較する。
const experienceSurface = tsumeShogiToneClassNames.tableSurface;

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
  recordOutcomeNotice,
  plies,
  phase,
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
  onDragBoardPiece,
  onDragHandPiece,
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
  onBackToHome,
  onOpenDiagnostics,
}: TsumeShogiPlayProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const experienceParam = searchParams.get("tsume-concept");
  const experience: TsumeShogiExperience =
    experienceParam === "focus" ? "focus" : "current";
  const surface = experienceSurface;
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
  const undoBesideHand = shortPlayArea;
  const drag = useTsumeShogiPieceDrag({
    enabled: experience === "focus" && acceptsInput && !promotionChoice,
    boardPieces,
    attackerHand,
    onDragBoardPiece,
    onDragHandPiece,
  });

  function changeExperience(next: TsumeShogiExperience): void {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tsume-concept", next);
    setSearchParams(nextParams, { replace: true });
  }

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
      background={<div className={cn("size-full", surface)} />}
      metrics={[
        { type: "problem-fact", text: `${plies}手詰` },
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
        <TsumeShogiHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <TsumeShogiResultScreen
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
      <TsumeShogiPieceDefs>
        {/* 榧盤と駒の位置は同じに保ち、駒の運び方だけを比較する。 */}
        <main
          ref={boardAreaRef}
          className={cn(
            "flex min-h-0 flex-1 items-center justify-center py-1 [container-type:size]",
            surface,
          )}
          style={boardSizeStyle}
          onPointerDownCapture={drag.onPointerDownCapture}
          onPointerMoveCapture={drag.onPointerMoveCapture}
          onPointerUpCapture={drag.onPointerUpCapture}
          onPointerCancelCapture={drag.onPointerCancelCapture}
          onClickCapture={drag.onClickCapture}
        >
          <div
            ref={boardGroupRef}
            className="flex w-(--board-width) flex-col gap-1"
          >
            <div className="h-(--piece-box-height)">
              <TsumeShogiPieceBox />
            </div>
            <div className="relative h-[calc((var(--board-width)-2*var(--board-frame))*386/352+2*var(--board-frame))]">
              <TsumeShogiClearAnimation
                active={progress === "clearing"}
                onClearAnimationComplete={onClearAnimationComplete}
              >
                <TsumeShogiBoard
                  dragEnabled={experience === "focus"}
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
            </div>
            <div className="h-(--komadai-height)">
              <TsumeShogiHand
                dragEnabled={experience === "focus"}
                hand={attackerHand}
                selectedPieceType={
                  selection?.type === "hand" ? selection.pieceType : null
                }
                availability={handAvailability}
                rejection={rejection}
                // 背の低い画面では、盤に高さを回すため駒台の横へ置く。
                leadingAction={undoBesideHand ? undoButton : undefined}
                onSelectHandPiece={onSelectHandPiece}
              />
            </div>
            <div className="h-5">
              <TsumeShogiPlayStatus
                plies={plies}
                phase={phase}
                shownMoves={shownMoves}
                precedingMoveTo={precedingMoveTo}
              />
            </div>
          </div>
          {/* 画面では駒で返し、理由は文で示さない。読み上げでも指せなかったことだけを伝える。 */}
          <p aria-live="polite" className="sr-only">
            {rejection && (
              <span key={getRejectionAnnouncementKey(rejection)}>
                指せません
              </span>
            )}
          </p>
        </main>
        {!undoBesideHand && (
          <footer
            className={cn("grid h-28 shrink-0 items-end px-4 pb-2", surface)}
          >
            <div className="flex h-14 items-center justify-center">
              {undoButton}
            </div>
          </footer>
        )}
      </TsumeShogiPieceDefs>
      {drag.ghost}
      {experienceParam !== null && (
        <TsumeShogiExperienceComparison
          experience={experience}
          onChange={changeExperience}
        />
      )}
    </GamePlayFrame>
  );
}
