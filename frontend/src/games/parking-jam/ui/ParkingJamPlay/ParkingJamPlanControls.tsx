import type { ParkingJamMove } from "@/games/parking-jam/puzzle/board";

type ParkingJamPlanControlsProps = {
  moves: readonly ParkingJamMove[];
  executing: boolean;
  onExecute: () => void;
  onUndoPlan: () => void;
  onClearPlan: () => void;
};

const DIRECTION_LABELS = { up: "↑", right: "→", down: "↓", left: "←" } as const;

export function ParkingJamPlanControls({
  moves,
  executing,
  onExecute,
  onUndoPlan,
  onClearPlan,
}: ParkingJamPlanControlsProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1" aria-label="出庫計画">
      <div className="flex h-7 items-center gap-1.5" aria-live="polite">
        {moves.length === 0 ? (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            車を選び、出庫方向を指定して順番を組み立てる
          </span>
        ) : (
          moves.map((move, index) => (
            <span key={move.vehicleId} className="flex h-7 min-w-8 items-center justify-center rounded-lg border border-slate-400/50 bg-white/80 px-1 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-white" aria-label={`${index + 1}番目 ${DIRECTION_LABELS[move.direction]}`}>
              {index + 1}{DIRECTION_LABELS[move.direction]}
            </span>
          ))
        )}
      </div>
      <div className="flex h-8 items-center gap-2">
        <button type="button" onClick={onUndoPlan} disabled={executing || moves.length === 0} className="rounded-full border border-slate-500/40 px-3 py-1 text-xs disabled:opacity-40">1手戻す</button>
        <button type="button" onClick={onExecute} disabled={executing || moves.length === 0} className="rounded-full bg-slate-800 px-4 py-1 text-xs font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{executing ? "出庫中" : "まとめて出庫"}</button>
        <button type="button" onClick={onClearPlan} disabled={executing || moves.length === 0} className="rounded-full border border-slate-500/40 px-3 py-1 text-xs disabled:opacity-40">消去</button>
      </div>
    </div>
  );
}
