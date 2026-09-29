import { Undo2 } from "lucide-react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type {
  ReflectionBoard as ReflectionBoardState,
  ReflectionInventory,
  ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import type { ReflectionClue } from "@/games/reflection/puzzle/laser";
import type {
  ReflectionSelection,
  ReflectionSessionStatus,
} from "@/games/reflection/session/session";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionClearedPanel } from "@/games/reflection/ui/ReflectionPlay/ReflectionClearedPanel";
import { ReflectionPlayHeader } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader";
import { ReflectionStock } from "@/games/reflection/ui/ReflectionPlay/ReflectionStock";

type ReflectionPlayProps = {
  difficultyLabel: string;
  status: ReflectionSessionStatus;
  board: ReflectionBoardState;
  clues: readonly ReflectionClue[];
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  elapsedMs: number;
  canUndo: boolean;
  canRestart: boolean;
  onTapCell: (cellIndex: number) => void;
  onTapStock: (piece: ReflectionPiece) => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function ReflectionPlay({
  difficultyLabel,
  status,
  board,
  clues,
  inventory,
  stock,
  selection,
  elapsedMs,
  canUndo,
  canRestart,
  onTapCell,
  onTapStock,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: ReflectionPlayProps) {
  const playing = status === "playing";

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <ReflectionPlayHeader
        difficultyLabel={difficultyLabel}
        elapsedMs={elapsedMs}
        canRestart={canRestart}
        onRestart={onRestart}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-6">
        <ReflectionBoard
          board={board}
          clues={clues}
          selection={selection}
          disabled={!playing}
          onTapCell={onTapCell}
        />
      </main>
      <footer className="grid min-h-36 shrink-0 content-center gap-3 px-4 pb-3">
        {playing ? (
          <>
            <ReflectionStock
              inventory={inventory}
              stock={stock}
              selection={selection}
              disabled={!playing}
              onTapStock={onTapStock}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo2 />
                待った
              </Button>
            </div>
          </>
        ) : (
          <ReflectionClearedPanel
            onReplay={onReplay}
            onStartNewProblem={onStartNewProblem}
          />
        )}
      </footer>
    </section>
  );
}
