import type { HamiltonianPathTraceStep } from "@/games/hamiltonian-path/puzzle/transitions";

/** 盤面の上の指の位置。盤面の左上を原点に、マス幅を 1 とした座標。 */
export type BoardPoint = { x: number; y: number };

/**
 * 指の動きをたどる刻み（マス幅に対する割合）。前の位置から今の位置までをこの刻みでたどり、
 * 速く動いた指がイベントの間に通り越したマスも順に拾う。
 */
export const FINGER_TRACE_STEP = 1 / 6;

/**
 * 今のマスから隣のマスへ移ったとみなすのに、指がマスの縁から入っていなければならない深さ（マス幅に対する割合）。
 * 手ぶれで縁を行き来しても、道が伸び縮みしないようにする。
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

/**
 * 指が今いるとみなすマス。`current` から別のマスへは、そのマスの縁から `CELL_SWITCH_INSET` 以上入ったときだけ移る。
 * 盤面の外へ出た指は、`current` に残る。
 */
function findFingerCell(
  size: number,
  point: BoardPoint,
  current: number,
): number {
  const cell = findCellAt(size, point);
  if (cell === null || cell === current) {
    return current;
  }
  const insideX = point.x - Math.floor(point.x);
  const insideY = point.y - Math.floor(point.y);
  const isNearEdge =
    insideX < CELL_SWITCH_INSET ||
    insideX > 1 - CELL_SWITCH_INSET ||
    insideY < CELL_SWITCH_INSET ||
    insideY > 1 - CELL_SWITCH_INSET;
  return isNearEdge ? current : cell;
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
