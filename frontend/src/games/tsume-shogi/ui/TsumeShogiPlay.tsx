import { type CSSProperties, useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import { Button } from "@/components/ui/button";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
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
  TsumeShogiSessionResult,
} from "@/games/tsume-shogi/session/session";
import {
  TsumeShogiBoard,
  tsumeShogiBoardFrameStyle,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { TsumeShogiClearedPanel } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiClearedPanel";
import { TsumeShogiHand } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox";
import { useShortPlayArea } from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-short-play-area";

type TsumeShogiPlayProps = GamePlayScreenProps<
  TsumeShogiDifficulty,
  TsumeShogiSessionResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    plies: number;
    phase: TsumeShogiSessionPhase;
    onWrongLine: boolean;
    remainingPlies: number;
    boardPieces: readonly TsumeShogiBoardPiece[];
    attackerHand: TsumeShogiHandCounts;
    lastMove: TsumeShogiMove | null;
    selection: TsumeShogiSelection | null;
    promotionChoice: TsumeShogiPromotionChoice | null;
    rejection: TsumeShogiRejection | null;
    onTapSquare: (square: TsumeShogiSquare) => void;
    onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
    onChoosePromotion: (promote: boolean) => void;
    onCancelPromotion: () => void;
  };

const rejectionMessages = {
  "not-check": "王手になる手だけ指せます",
  illegal: "その手は指せません",
} as const satisfies Record<TsumeShogiRejection["reason"], string>;

function describePhase(
  phase: TsumeShogiSessionPhase,
  onWrongLine: boolean,
  plies: number,
  remainingPlies: number,
): string {
  if (phase === "defender") return "玉方が考えています";
  if (phase === "refuted") return `${plies}手では詰みません`;
  if (onWrongLine) return `${plies}手では詰みません（残り${remainingPlies}手）`;
  return `攻方の番（残り${remainingPlies}手）`;
}

/**
 * 盤の幅。盤の縁と表記（`tsumeShogiBoardFrameStyle`）を含め、升は実物の盤と同じ縦長（横 35.2 : 縦 38.6）。
 * 盤の上下に玉方・攻方の駒台（各 3rem）、その下に直前の手（1.25rem）を置き、隙間を除いた高さと、
 * 幅のどちらにも収まる大きさにする。360px 以上の画面では左右に余白（最大 0.75rem）を空け、
 * 320px では余白を取らない。PC では 40rem まで広げる。
 */
const boardSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--board-gutter": "clamp(0px, calc((100cqw - 320px) / 3), 0.75rem)",
  "--board-chrome": "calc(2 * 3rem + 1.25rem + 3 * 0.25rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - var(--board-chrome) - var(--board-file-band) - var(--board-frame)) * 352 / 386 + var(--board-frame) + var(--board-rank-band)), 40rem)",
} as CSSProperties;

export function TsumeShogiPlay({
  progress,
  elapsedMs,
  result,
  plies,
  phase,
  onWrongLine,
  remainingPlies,
  boardPieces,
  attackerHand,
  lastMove,
  selection,
  promotionChoice,
  rejection,
  canUndo,
  canRestart,
  onTapSquare,
  onTapHand,
  onChoosePromotion,
  onCancelPromotion,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TsumeShogiPlayProps) {
  const acceptsInput = progress === "playing" && phase === "attacker";
  const boardAreaRef = useRef<HTMLElement>(null);
  const boardGroupRef = useRef<HTMLDivElement>(null);
  const shortPlayArea = useShortPlayArea(boardAreaRef, boardGroupRef);
  const undoButton = <UndoButton disabled={!canUndo} onUndo={onUndo} />;

  // 完成演出ができるまでは、詰んだらすぐ結果へ進める。
  useEffect(() => {
    if (progress === "clearing") onClearAnimationComplete();
  }, [progress, onClearAnimationComplete]);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={TSUME_SHOGI_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "手数", count: plies, reservedDigits: 1 },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      // 遊び方は盤面の操作が出来上がってから足す。
      renderHowToPlayDialog={() => null}
      renderResultScreen={(clearedResult) => (
        <TsumeShogiClearedPanel
          plies={plies}
          result={clearedResult}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onBackToHome={onBackToHome}
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
            <div className="relative h-[calc((var(--board-width)-var(--board-frame)-var(--board-rank-band))*386/352+var(--board-file-band)+var(--board-frame))]">
              <TsumeShogiBoard
                boardPieces={boardPieces}
                selection={selection}
                lastMove={lastMove}
                mated={progress !== "playing"}
                interactionDisabled={!acceptsInput}
                onSelectSquare={onTapSquare}
              />
            </div>
            <div className="h-12">
              <TsumeShogiHand
                hand={attackerHand}
                selectedPieceType={
                  selection?.type === "hand" ? selection.pieceType : null
                }
                disabled={!acceptsInput}
                // 背の低い画面では、待ったの欄の高さを盤に回し、待ったを駒台の右端に置く。
                trailingAction={shortPlayArea ? undoButton : undefined}
                onSelectHandPiece={onTapHand}
              />
            </div>
            <div className="h-5 px-(--board-frame)">
              {promotionChoice ? (
                <div role="group" aria-label="成・不成" className="flex gap-2">
                  <Button type="button" onClick={() => onChoosePromotion(true)}>
                    成る
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChoosePromotion(false)}
                  >
                    成らない
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancelPromotion}
                  >
                    やめる
                  </Button>
                </div>
              ) : (
                <p role="status" className="truncate text-supporting">
                  {rejection
                    ? rejectionMessages[rejection.reason]
                    : describePhase(phase, onWrongLine, plies, remainingPlies)}
                </p>
              )}
            </div>
          </div>
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
