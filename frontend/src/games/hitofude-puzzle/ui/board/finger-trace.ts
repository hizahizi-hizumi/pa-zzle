import { getHamiltonianPathCellPosition } from "@/games/hamiltonian-path/puzzle/board";
import type { HamiltonianPathTraceStep } from "@/games/hamiltonian-path/puzzle/transitions";

/** 盤面の上の指の位置。盤面の左上を原点に、マス幅を 1 とした座標。 */
export type BoardPoint = { x: number; y: number };

/**
 * 指の動きをたどる刻み（マス幅に対する割合）。前の位置から今の位置までをこの刻みでたどり、
 * 速く動いた指がイベントの間に通り越したマスも順に拾う。
 */
export const FINGER_TRACE_STEP = 1 / 6;

/**
 * 今のマスから隣のマスへ移ったとみなすのに、指が今のマスの縁から外へ出ていなければならない距離（マス幅に対する割合）。
 * 隣のマスの縁から幅のこの割合だけ内側へ入るまで今のマスに残り、手ぶれで縁を行き来しても道が伸び縮みしないようにする。
 * 横と縦で別々に測るので、なぞる向きと平行な縁の近くを動く指も、なぞる向きへは移る。
 */
export const CELL_SWITCH_INSET = 0.15;

/** 指の下のマス。盤面の外なら `null`。 */
export function findCellAt(size: number, { x, y }: BoardPoint): number | null {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= size || row >= size) {
    return null;
  }
  return row * size + column;
}

/** 指の座標 `value` が、`start` から幅 1 の範囲から `CELL_SWITCH_INSET` 以上外へ出た向き。出ていなければ 0。 */
function findSwitchOffset(value: number, start: number): -1 | 0 | 1 {
  if (value <= start - CELL_SWITCH_INSET) {
    return -1;
  }
  if (value >= start + 1 + CELL_SWITCH_INSET) {
    return 1;
  }
  return 0;
}

/**
 * 指が今いるとみなすマス。`current` のマスから、横・縦それぞれ `CELL_SWITCH_INSET` 以上外へ出た向きへ1マス移る。
 * 盤面の外の指は盤面の縁にあるとみなし、外を滑らせた指も縁のマスを1マスずつ移る。
 */
function findFingerCell(
  size: number,
  point: BoardPoint,
  current: number,
): number {
  const { row, column } = getHamiltonianPathCellPosition(size, current);
  const x = Math.min(Math.max(point.x, 0), size);
  const y = Math.min(Math.max(point.y, 0), size);
  const nextRow = row + findSwitchOffset(y, row);
  const nextColumn = column + findSwitchOffset(x, column);
  return nextRow * size + nextColumn;
}

/**
 * 指が `from` から `to` へ動いた間に、指のいるマスが移った順の一覧と、動いた後に指がいるマス。
 * 斜めに移ったときにどちらの角を先に通るかは、その時点までの指の動きが横と縦のどちらに大きいかで決める。
 */
export function listFingerSteps(
  size: number,
  from: BoardPoint,
  to: BoardPoint,
  current: number,
): { steps: HamiltonianPathTraceStep[]; cell: number } {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const sampleCount = Math.max(
    1,
    Math.ceil(Math.hypot(deltaX, deltaY) / FINGER_TRACE_STEP),
  );
  const steps: HamiltonianPathTraceStep[] = [];
  let cell = current;
  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const ratio = sample / sampleCount;
    const next = findFingerCell(
      size,
      { x: from.x + deltaX * ratio, y: from.y + deltaY * ratio },
      cell,
    );
    if (next !== cell) {
      steps.push({
        from: cell,
        to: next,
        horizontalFirst: Math.abs(deltaX) >= Math.abs(deltaY),
      });
      cell = next;
    }
  }
  return { steps, cell };
}
