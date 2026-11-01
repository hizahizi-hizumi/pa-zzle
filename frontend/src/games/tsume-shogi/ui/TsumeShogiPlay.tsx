import { type CSSProperties, useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
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
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPlayStatus";
import { useShortPlayArea } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-short-play-area";

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
    selection: TsumeShogiSelection | null;
    promotionChoice: TsumeShogiPromotionChoice | null;
    rejection: TsumeShogiRejection | null;
    onSelectSquare: (square: TsumeShogiSquare) => void;
    onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
    onChoosePromotion: (promote: boolean) => void;
    onCancelPromotion: () => void;
    onClearSelection: () => void;
  };

/**
 * 盤の幅。盤の縁と表記（`tsumeShogiBoardFrameStyle`）を含め、升は実物の盤と同じ縦長（横 35.2 : 縦 38.6）。
 * 盤の上下に玉方・攻方の駒台（各 3rem）、その下に直前の手（1.25rem）を置き、隙間を除いた高さと、
 * 幅のどちらにも収まる大きさにする。360px 以上の画面では左右に余白（最大 0.75rem）を空け、
 * 320px では余白を取らない。PC では 40rem まで広げる。
 */
const boardSizeStyle = {
  "--board-gutter": "clamp(0px, calc((100cqw - 320px) / 3), 0.75rem)",
  ...tsumeShogiBoardFrameStyle,
  "--board-chrome": "calc(2 * 3rem + 1.25rem + 3 * 0.25rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - var(--board-chrome) - var(--board-file-band) - var(--board-bottom)) * 352 / 386 + var(--board-frame) + var(--board-rank-band)), 40rem)",
} as CSSProperties;

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
  selection,
  promotionChoice,
  rejection,
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
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TsumeShogiPlayProps) {
  const playing = progress === "playing";
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
      metrics={[
        { type: "problem-fact", text: `${plies}手詰` },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
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
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <TsumeShogiPieceDefs>
        {/* 他のゲームと同じく、盤を残りの高さの中央に置き、待ったを画面の下の中央に置く。 */}
        <main
          ref={boardAreaRef}
          className="flex min-h-0 flex-1 items-center justify-center py-1 [container-type:size]"
          style={boardSizeStyle}
        >
          {/* 玉方の駒台・盤・攻方の駒台を、盤の幅にそろえた同じ形の帯で上下対称に並べる。 */}
          <div
            ref={boardGroupRef}
            className="flex w-(--board-width) flex-col gap-1"
          >
            <div className="h-12">
              <TsumeShogiPieceBox />
            </div>
            <div className="relative h-[calc((var(--board-width)-var(--board-frame)-var(--board-rank-band))*386/352+var(--board-file-band)+var(--board-bottom))]">
              <TsumeShogiClearAnimation
                active={progress === "clearing"}
                onClearAnimationComplete={onClearAnimationComplete}
              >
                <TsumeShogiBoard
                  boardPieces={boardPieces}
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
            <div className="h-12">
              <TsumeShogiHand
                hand={attackerHand}
                selectedPieceType={
                  selection?.type === "hand" ? selection.pieceType : null
                }
                availability={handAvailability}
                rejection={rejection}
                // 背の低い画面では、待ったの欄の高さを盤に回し、待ったを駒台の右端に置く。
                trailingAction={shortPlayArea ? undoButton : undefined}
                onSelectHandPiece={onSelectHandPiece}
              />
            </div>
            <div className="h-5 px-(--board-frame)">
              <TsumeShogiPlayStatus
                plies={plies}
                phase={phase}
                shownMoves={shownMoves}
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
        {!shortPlayArea && (
          <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
            <div className="flex h-14 items-center justify-center">
              {undoButton}
            </div>
          </footer>
        )}
      </TsumeShogiPieceDefs>
    </GamePlayFrame>
  );
}
