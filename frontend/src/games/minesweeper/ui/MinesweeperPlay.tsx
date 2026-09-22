import { useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type {
  MinesweeperSessionStatus,
  MinesweeperVisibleCell,
} from "../session/session";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "./board/MinesweeperBoard";
import { MinesweeperPlayHeader } from "./MinesweeperPlay/MinesweeperPlayHeader";
import { MinesweeperStatusPanel } from "./MinesweeperPlay/MinesweeperStatusPanel";

type MinesweeperPlayProps = {
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  visibleCells: readonly MinesweeperVisibleCell[];
  status: MinesweeperSessionStatus;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  onReplay: () => void;
  onBackToHome: () => void;
};

export function MinesweeperPlay({
  rows,
  columns,
  mineCount,
  flagCount,
  visibleCells,
  status,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  onReplay,
  onBackToHome,
}: MinesweeperPlayProps) {
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <MinesweeperPlayHeader
        mineCount={mineCount}
        flagCount={flagCount}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <MinesweeperBoard
          rows={rows}
          columns={columns}
          cells={visibleCells}
          mode={mode}
          disabled={status !== "playing"}
          onRevealCell={onRevealCell}
          onToggleFlag={onToggleFlag}
          onChordCell={onChordCell}
        />
      </main>
      <footer className="grid shrink-0 gap-3 px-4 pb-4 pt-2">
        <MinesweeperStatusPanel status={status} onReplay={onReplay} />
        <div
          role="group"
          aria-label="操作モード"
          className="mx-auto grid w-full max-w-64 grid-cols-2 gap-2"
        >
          <Button
            variant={mode === "reveal" ? "secondary" : "outline"}
            aria-pressed={mode === "reveal"}
            onClick={() => setMode("reveal")}
            disabled={status !== "playing"}
          >
            開示
          </Button>
          <Button
            variant={mode === "flag" ? "secondary" : "outline"}
            aria-pressed={mode === "flag"}
            onClick={() => setMode("flag")}
            disabled={status !== "playing"}
          >
            旗
          </Button>
        </div>
      </footer>
    </section>
  );
}
