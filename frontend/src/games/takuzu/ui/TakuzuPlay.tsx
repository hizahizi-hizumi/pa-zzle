import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuSessionStatus,
} from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuClearedPanel } from "@/games/takuzu/ui/TakuzuPlay/TakuzuClearedPanel";
import { TakuzuPlayHeader } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader";

type TakuzuPlayProps = {
  difficulty: TakuzuDifficulty;
  size: number;
  cells: readonly TakuzuCellView[];
  status: TakuzuSessionStatus;
  elapsedMs: number;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onRestart: () => void;
  onReplay: () => void;
  onBackToHome: () => void;
};

export function TakuzuPlay({
  difficulty,
  size,
  cells,
  status,
  elapsedMs,
  onCycleCell,
  onRestart,
  onReplay,
  onBackToHome,
}: TakuzuPlayProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <TakuzuPlayHeader
        difficulty={difficulty}
        elapsedMs={elapsedMs}
        canRestart={status === "playing"}
        onRestart={onRestart}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <TakuzuBoard
          size={size}
          cells={cells}
          disabled={status !== "playing"}
          onCycleCell={onCycleCell}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-center px-4 pb-2">
        {status === "cleared" ? (
          <TakuzuClearedPanel onReplay={onReplay} />
        ) : null}
      </footer>
    </section>
  );
}
