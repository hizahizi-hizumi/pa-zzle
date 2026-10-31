import { useEffect } from "react";

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
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiClearedPanel } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiClearedPanel";
import { TsumeShogiHand } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";

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
      <main className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-3 py-2">
        <TsumeShogiBoard
          boardPieces={boardPieces}
          selection={selection}
          lastMove={lastMove}
          disabled={!acceptsInput}
          onTapSquare={onTapSquare}
        />
        <TsumeShogiHand
          hand={attackerHand}
          selectedPieceType={
            selection?.type === "hand" ? selection.pieceType : null
          }
          disabled={!acceptsInput}
          onTapHand={onTapHand}
        />
        <p role="status" className="text-supporting">
          {rejection
            ? rejectionMessages[rejection.reason]
            : describePhase(phase, onWrongLine, plies, remainingPlies)}
        </p>
        {promotionChoice && (
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
            <Button type="button" variant="ghost" onClick={onCancelPromotion}>
              やめる
            </Button>
          </div>
        )}
      </main>
      <footer className="flex shrink-0 justify-center px-3 pb-2">
        <UndoButton disabled={!canUndo} onUndo={onUndo} />
      </footer>
    </GamePlayFrame>
  );
}
