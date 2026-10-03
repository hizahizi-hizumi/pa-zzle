import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import { UndoButton } from "@/components/UndoButton";
import { Button } from "@/components/ui/button";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type {
  TsumeShogiPlayedMove,
  TsumeShogiProgress,
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
import { readTsumeShogiHowToPlaySeen } from "@/games/tsume-shogi/ui/how-to-play-seen";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPlayStatus";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type TsumeShogiPlayProps = {
  difficultyLabel: string;
  plies: number;
  progress: TsumeShogiProgress;
  phase: TsumeShogiSessionPhase;
  onWrongLine: boolean;
  boardPieces: readonly TsumeShogiBoardPiece[];
  attackerHand: TsumeShogiHandCounts;
  shownMoves: readonly TsumeShogiPlayedMove[];
  shownMovesRestored: boolean;
  selection: TsumeShogiSelection | null;
  promotionChoice: TsumeShogiPromotionChoice | null;
  rejection: TsumeShogiRejection | null;
  elapsedMs: number;
  canUndo: boolean;
  canRestart: boolean;
  /** クリアしたプレイの評価。クリアするまでは `null`。 */
  result: TsumeShogiResult | null;
  recordOutcomeNotice: ReactNode;
  onTapSquare: (square: TsumeShogiSquare) => void;
  onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
  onChoosePromotion: (promote: boolean) => void;
  onCancelPromotion: () => void;
  onClearSelection: () => void;
  onReturnToDecision: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  /** 内部診断が有効なときだけ渡し、メニューに検証情報を出す。 */
  onOpenDiagnostics?: () => void;
};

/**
 * 盤の幅。升は横11:縦12で、盤の右に段（0.5625rem と隙間 1px）、上に筋（0.75rem）の表記を置く。
 * 盤の上下に玉方の持駒（1.25rem）・直前の手（1.25rem）・攻方の持駒（3rem）の行と隙間（0.75rem）を取り、
 * 残りの高さと幅のどちらにも収まる大きさにする。PC では 40rem まで広げる。
 */
const boardSizeStyle = {
  "--board-width":
    "min(100cqw, calc((100cqh - 0.75rem - 6.25rem) * 11 / 12 + 0.5625rem + 1px), 40rem)",
} as CSSProperties;

export function TsumeShogiPlay({
  difficultyLabel,
  plies,
  progress,
  phase,
  onWrongLine,
  boardPieces,
  attackerHand,
  shownMoves,
  shownMovesRestored,
  selection,
  promotionChoice,
  rejection,
  elapsedMs,
  canUndo,
  canRestart,
  result,
  recordOutcomeNotice,
  onTapSquare,
  onTapHand,
  onChoosePromotion,
  onCancelPromotion,
  onClearSelection,
  onReturnToDecision,
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
  // 初めて遊ぶときだけ、盤より先に遊び方を開く（intro）。
  const [howToPlay, setHowToPlay] = useState<"closed" | "intro" | "open">(() =>
    readTsumeShogiHowToPlaySeen() ? "closed" : "intro",
  );
  const playing = progress === "playing";
  const acceptsInput = playing && phase === "attacker";
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : playing && phase === "defender"
      ? "waiting"
      : "unavailable";
  const howToPlayOpen = howToPlay !== "closed";

  function closeHowToPlay() {
    // 初めての遊び方を読んでいた時間はプレイ時間に含めないよう、閉じたところから測り直す。
    if (howToPlay === "intro") {
      onReplay();
    }
    setHowToPlay("closed");
  }

  useEffect(() => {
    // 遊び方を開いている間の Esc は遊び方を閉じる操作なので、盤の選択には効かせない。
    if (!playing || howToPlayOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      if (promotionChoice) {
        onCancelPromotion();
      } else {
        onClearSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    playing,
    howToPlayOpen,
    promotionChoice,
    onCancelPromotion,
    onClearSelection,
  ]);

  // 完成演出の間は詰め上がりの盤をそのまま見せ、演出を終えてから結果画面に切り替える。
  if (progress === "result" && result) {
    return (
      <TsumeShogiResultScreen
        difficultyLabel={difficultyLabel}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <PlayHeader
        title={TSUME_SHOGI_DISPLAY_NAME}
        metricGroups={[
          [
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
        onOpenHowToPlay={() => setHowToPlay("open")}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <TsumeShogiHowToPlayDialog
        open={howToPlayOpen}
        onClose={closeHowToPlay}
      />
      {/* 玉方の持駒・盤・攻方の持駒を1つのまとまりとして、盤の幅にそろえて並べる。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-0.5 py-1 [container-type:size]">
        <div
          className="flex w-(--board-width) flex-col gap-1"
          style={boardSizeStyle}
        >
          <div className="h-5 px-1">
            <TsumeShogiPieceBox />
          </div>
          <div className="relative h-[calc((var(--board-width)-0.5625rem-1px)*12/11+0.75rem)]">
            <TsumeShogiClearAnimation
              active={progress === "clearing"}
              onComplete={onClearAnimationComplete}
            >
              <TsumeShogiBoard
                boardPieces={boardPieces}
                selection={selection}
                shownMoves={shownMoves}
                shownMovesRestored={shownMovesRestored}
                promotionChoice={promotionChoice}
                rejection={rejection}
                mated={progress !== "playing"}
                disabled={!acceptsInput}
                onTapSquare={onTapSquare}
                onChoosePromotion={onChoosePromotion}
              />
            </TsumeShogiClearAnimation>
          </div>
          <div className="h-5 px-1">
            <TsumeShogiPlayStatus
              phase={phase}
              shownMoves={shownMoves}
              rejection={rejection}
            />
          </div>
          <div className="flex min-h-12 items-center justify-between gap-2 px-1">
            <TsumeShogiHand
              hand={attackerHand}
              selectedPieceType={
                selection?.type === "hand" ? selection.pieceType : null
              }
              availability={handAvailability}
              onTapHand={onTapHand}
            />
            <div className="flex shrink-0 items-center gap-2">
              {onWrongLine && playing && (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="判断地点へ戻る"
                  onClick={onReturnToDecision}
                >
                  戻る
                </Button>
              )}
              <UndoButton disabled={!playing || !canUndo} onUndo={onUndo} />
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
