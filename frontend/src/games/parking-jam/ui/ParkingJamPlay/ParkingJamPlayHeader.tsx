import { RotateCcw, Undo2 } from "lucide-react";

import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";

type ParkingJamPlayHeaderProps = {
  elapsedMs: number;
  failedMoveCount: number;
  canUndo: boolean;
  canRestart: boolean;
  playing: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

export function ParkingJamPlayHeader({
  elapsedMs,
  failedMoveCount,
  canUndo,
  canRestart,
  playing,
  onUndo,
  onRestart,
}: ParkingJamPlayHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">パーキングジャム</p>
        <div className="flex gap-3 text-xs tabular-nums text-muted-foreground">
          <span>{formatParkingJamElapsedTime(elapsedMs)}</span>
          <span>ミス {failedMoveCount}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="待った"
          disabled={!canUndo}
          onClick={onUndo}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          <Undo2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label="やり直す"
          disabled={!playing || !canRestart}
          onClick={onRestart}
          className="inline-flex size-11 items-center justify-center rounded-full text-destructive outline-none transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-destructive/20"
        >
          <RotateCcw className="size-5" />
        </button>
      </div>
    </header>
  );
}
