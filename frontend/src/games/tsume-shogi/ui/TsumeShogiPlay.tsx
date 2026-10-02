import { type CSSProperties, useEffect, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import { UndoButton } from "@/components/UndoButton";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type {
  TsumeShogiPlayedMove,
  TsumeShogiProgress,
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
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { TsumeShogiClearedPanel } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiClearedPanel";
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
  onTapSquare: (square: TsumeShogiSquare) => void;
  onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
  onChoosePromotion: (promote: boolean) => void;
  onCancelPromotion: () => void;
  onClearSelection: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/**
 * 盤の幅。盤の縁と表記（`tsumeShogiBoardFrameStyle`）を含め、升は横11:縦12。
 * 盤の上下に玉方の持駒（1.25rem）・直前の手（1.25rem）・攻方の持駒（3rem）の行と隙間（0.75rem）を取り、
 * 残りの高さと幅のどちらにも収まる大きさにする。360px 以上の画面では左右に余白（最大 0.75rem）を空け、
 * 320px では余白を取らずに升を 34px に保つ。PC では 40rem まで広げる。
 */
const boardSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--board-gutter": "clamp(0px, calc((100cqw - 320px) / 3), 0.75rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - 6.25rem - var(--board-file-band) - var(--board-frame)) * 11 / 12 + var(--board-frame) + var(--board-rank-band)), 40rem)",
} as CSSProperties;

export function TsumeShogiPlay({
  difficultyLabel,
  plies,
  progress,
  phase,
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
  onTapSquare,
  onTapHand,
  onChoosePromotion,
  onCancelPromotion,
  onClearSelection,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
}: TsumeShogiPlayProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const playing = progress === "playing";
  const acceptsInput = playing && phase === "attacker";
  const handAvailability: TsumeShogiHandAvailability = acceptsInput
    ? "available"
    : playing && phase === "defender"
      ? "waiting"
      : "unavailable";

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
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
      />
      <TsumeShogiHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
      {/* 玉方の持駒・盤・攻方の持駒を1つのまとまりとして、盤の幅にそろえて並べる。 */}
      <main
        className="flex min-h-0 flex-1 items-center justify-center py-1 [container-type:size]"
        style={boardSizeStyle}
      >
        <div className="flex w-(--board-width) flex-col gap-1">
          <div className="h-5 pl-(--board-frame)">
            <TsumeShogiPieceBox />
          </div>
          <div className="relative h-[calc((var(--board-width)-var(--board-frame)-var(--board-rank-band))*12/11+var(--board-file-band)+var(--board-frame))]">
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
            {progress === "result" && (
              <TsumeShogiClearedPanel
                difficultyLabel={difficultyLabel}
                plies={plies}
                onReplay={onReplay}
                onStartNewProblem={onStartNewProblem}
              />
            )}
          </div>
          <div className="h-5 px-(--board-frame)">
            <TsumeShogiPlayStatus
              plies={plies}
              phase={phase}
              shownMoves={shownMoves}
              rejection={rejection}
            />
          </div>
          <div className="flex min-h-12 items-center justify-between gap-3 pl-(--board-frame)">
            <TsumeShogiHand
              hand={attackerHand}
              selectedPieceType={
                selection?.type === "hand" ? selection.pieceType : null
              }
              availability={handAvailability}
              onTapHand={onTapHand}
            />
            <div className="flex shrink-0 items-center gap-2">
              <UndoButton disabled={!playing || !canUndo} onUndo={onUndo} />
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
