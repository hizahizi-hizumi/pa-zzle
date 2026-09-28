import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { ReflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type {
  ReflectionLaserView,
  ReflectionProgress,
} from "@/games/reflection/play/use-reflection-play";
import type {
  ReflectionBoard as ReflectionBoardState,
  ReflectionInventory,
  ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { readReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionClearedPanel } from "@/games/reflection/ui/ReflectionPlay/ReflectionClearedPanel";
import { ReflectionLaserStatus } from "@/games/reflection/ui/ReflectionPlay/ReflectionLaserStatus";
import { ReflectionPlayHeader } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader";
import {
  listReflectionStockPieces,
  ReflectionStock,
} from "@/games/reflection/ui/ReflectionPlay/ReflectionStock";
import { UndoButton } from "@/games/reflection/ui/ReflectionPlay/UndoButton";

type ReflectionPlayProps = {
  /** 結果に出す難易度の表示名。 */
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  progress: ReflectionProgress;
  board: ReflectionBoardState;
  clues: readonly ReflectionClue[];
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  laser: ReflectionLaserView | null;
  relocationCount: number;
  undoCount: number;
  elapsedMs: number;
  canUndo: boolean;
  canRestart: boolean;
  onTapCell: (cellIndex: number) => void;
  onTapStock: (piece: ReflectionPiece) => void;
  onTapClue: (entry: ReflectionEntry) => void;
  onRemovePiece: (cellIndex: number) => void;
  onClearSelection: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty?: () => void;
  onBackToHome: () => void;
};

/** 数字キーの `1` から順に、ストックに並ぶ種類を選ぶ。 */
function getStockKeyIndex(key: string): number | null {
  return /^[1-9]$/.test(key) ? Number(key) - 1 : null;
}

export function ReflectionPlay({
  difficultyLabel,
  laserPathMode,
  progress,
  board,
  clues,
  inventory,
  stock,
  selection,
  laser,
  relocationCount,
  undoCount,
  elapsedMs,
  canUndo,
  canRestart,
  onTapCell,
  onTapStock,
  onTapClue,
  onRemovePiece,
  onClearSelection,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
}: ReflectionPlayProps) {
  // 初めて遊ぶときだけ、盤面より先に遊び方を開く（intro）。
  const [howToPlay, setHowToPlay] = useState<"closed" | "intro" | "open">(() =>
    readReflectionHowToPlaySeen() ? "closed" : "intro",
  );
  const playing = progress === "playing";

  function closeHowToPlay() {
    // 初めての遊び方を読んでいた時間はプレイ時間に含めないよう、閉じたところから測り直す。
    if (howToPlay === "intro") {
      onReplay();
    }
    setHowToPlay("closed");
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    // メニューやダイアログは別の場所へ描かれるが、React のイベントはここまで届くため、画面の中の操作に限る。
    if (
      !playing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !(event.target instanceof Node) ||
      !event.currentTarget.contains(event.target)
    ) {
      return;
    }

    if (event.key === "Escape") {
      onClearSelection();
      return;
    }

    const stockIndex = getStockKeyIndex(event.key);
    const piece =
      stockIndex === null
        ? undefined
        : listReflectionStockPieces(inventory)[stockIndex];
    if (piece) {
      event.preventDefault();
      onTapStock(piece);
    }
  }

  return (
    <section
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]"
      onKeyDown={handleKeyDown}
    >
      <BrandIdentityHeader />
      <ReflectionPlayHeader
        relocationCount={relocationCount}
        elapsedMs={elapsedMs}
        undoCount={undoCount}
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlay("open")}
      />
      <ReflectionHowToPlayDialog
        open={howToPlay !== "closed"}
        laserPathMode={laserPathMode}
        onClose={closeHowToPlay}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-1 py-2 [container-type:size] sm:px-3">
        <div className="relative aspect-square w-[min(100cqw,100cqh,44rem)]">
          <ReflectionBoard
            board={board}
            clues={clues}
            selection={selection}
            laser={laser}
            progress={progress}
            onTapCell={onTapCell}
            onTapClue={onTapClue}
            onRemovePiece={onRemovePiece}
            onClearAnimationComplete={onClearAnimationComplete}
          />
          {progress === "result" && (
            <ReflectionClearedPanel
              difficultyLabel={difficultyLabel}
              onReplay={onReplay}
              onStartNewProblem={onStartNewProblem}
            />
          )}
        </div>
      </main>
      <footer className="grid shrink-0 gap-2 px-3 pb-2">
        <ReflectionLaserStatus laser={laser} />
        <ReflectionStock
          inventory={inventory}
          stock={stock}
          selection={selection}
          disabled={!playing}
          onTapStock={onTapStock}
        />
        <div className="flex h-12 items-center justify-center">
          <UndoButton disabled={!playing || !canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </section>
  );
}
