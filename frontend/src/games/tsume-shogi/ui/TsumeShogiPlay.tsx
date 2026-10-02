import { PlayHeader } from "@/components/PlayHeader";
import { Button } from "@/components/ui/button";
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
} from "@/games/tsume-shogi/session/session";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiClearedPanel } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiClearedPanel";
import { TsumeShogiHand } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type TsumeShogiPlayProps = {
  difficultyLabel: string;
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
  elapsedMs: number;
  canUndo: boolean;
  canRestart: boolean;
  onTapSquare: (square: TsumeShogiSquare) => void;
  onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
  onChoosePromotion: (promote: boolean) => void;
  onCancelPromotion: () => void;
  onReturnToDecision: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

const rejectionMessages = {
  "not-check": "王手になる手だけ指せます",
  illegal: "その手は指せません",
} as const satisfies Record<TsumeShogiRejection["reason"], string>;

function describePhase(
  phase: TsumeShogiSessionPhase,
  onWrongLine: boolean,
  remainingPlies: number,
): string {
  if (phase === "defender") return "玉方が考えています";
  if (phase === "refuted") return "この筋では詰みません";
  if (onWrongLine) return `この筋では詰みません（残り${remainingPlies}手）`;
  return `攻方の番（残り${remainingPlies}手）`;
}

export function TsumeShogiPlay({
  difficultyLabel,
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
  elapsedMs,
  canUndo,
  canRestart,
  onTapSquare,
  onTapHand,
  onChoosePromotion,
  onCancelPromotion,
  onReturnToDecision,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
}: TsumeShogiPlayProps) {
  const acceptsInput = phase === "attacker";

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      <PlayHeader
        title={TSUME_SHOGI_DISPLAY_NAME}
        metricGroups={[
          [
            { label: "難易度", value: difficultyLabel },
            { label: "手数", value: `${plies}手詰` },
            { label: "時間", value: formatElapsedTime(elapsedMs) },
          ],
        ]}
        onRestart={onRestart}
        canRestart={canRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
      <TsumeShogiBoard
        boardPieces={boardPieces}
        selection={selection}
        lastMove={lastMove}
        disabled={!acceptsInput}
        onTapSquare={onTapSquare}
      />
      {phase === "cleared" ? (
        <TsumeShogiClearedPanel
          plies={plies}
          elapsedMs={elapsedMs}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onBackToHome={onBackToHome}
        />
      ) : (
        <>
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
              : describePhase(phase, onWrongLine, remainingPlies)}
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
          <div className="flex gap-2">
            {onWrongLine && (
              <Button type="button" onClick={onReturnToDecision}>
                判断地点へ戻る
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!canUndo}
              onClick={onUndo}
            >
              元に戻す
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
