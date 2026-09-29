import {
  fromReflectionCellCode,
  type ReflectionCellCode,
  reflectionCellCodes,
  reflectionCellsByCode,
} from "@/games/reflection/problem/generation/cell-code";
import type { ReflectionInventory } from "@/games/reflection/puzzle/board";
import {
  getReflectionEntryIndex,
  getReflectionEntryState,
  getReflectionExitEntry,
  getReflectionLeavingDirection,
  isSameReflectionEntry,
  listReflectionEntries,
  type ReflectionClue,
  type ReflectionDirection,
  type ReflectionEntry,
  type ReflectionOutcome,
  stepReflectionPosition,
} from "@/games/reflection/puzzle/laser";
import { isReflectionClueMatch } from "@/games/reflection/puzzle/rules";

export type ReflectionTrialSolveInput = {
  size: number;
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
};

/**
 * 一致表示を見ながら試し置きで進めた経過。
 * - `status`: `solved` は全ピースを置いて全外周ヒントが一致した。`stuck` はまだ通っていない盤面への手が無くなった。
 *   `move-limit-reached` は手数の上限（ピース数 × 20 + 20）に達した。
 * - `cleanFixCount`: 狙った外周ヒントを、一致していた外周ヒントを崩さずに一致させた手の数。
 * - `breakingFixCount` / `brokenMatchCount`: 狙った外周ヒントを一致させる代わりに一致を崩した手の数と、崩した一致の延べ数。
 * - `advanceCount`: 狙った外周ヒントは一致しないが、一致の数を増やした手の数。
 * - `detourCount`: 狙った外周ヒントを一致させる手も一致の数を増やす手も無く、別の置き方を試した手の数（一致を崩すこともある）。
 * - `retryCount`: `breakingFixCount + detourCount`。1本ずつ満たす進め方が行き詰まり、崩したり回り道をしたりした手の数。
 */
export type ReflectionTrialSolveTrace = {
  status: "solved" | "stuck" | "move-limit-reached";
  moveCount: number;
  cleanFixCount: number;
  breakingFixCount: number;
  brokenMatchCount: number;
  advanceCount: number;
  detourCount: number;
  retryCount: number;
};

type TraceResult = {
  outcome: ReflectionOutcome;
  distance: number;
  cells: readonly number[];
  /** 光が出た外周位置の番号。吸収では `null`。 */
  exitIndex: number | null;
};

/** 盤面の変更。`cellIndex` のマスを `code` にする。移動は2つの変更（移す先に置き、元を空ける）で表す。 */
type CellChange = { cellIndex: number; code: ReflectionCellCode };

type Move = readonly CellChange[];

type EvaluatedMove = {
  move: Move;
  traces: readonly TraceResult[];
  matches: readonly boolean[];
  matchCount: number;
  key: string;
};

type MoveKind = "clean-fix" | "breaking-fix" | "advance" | "detour";

const MOVES_PER_PIECE = 20;
const EXTRA_MOVES = 20;

const pieceCodes = reflectionCellCodes.filter((code) => code !== 0);

function toStockCounts(inventory: ReflectionInventory): number[] {
  return reflectionCellCodes.map(function countCode(code) {
    const cell = reflectionCellsByCode[code];
    return cell === null ? 0 : inventory[cell];
  });
}

function traceLaser(
  size: number,
  cells: Int8Array,
  entry: ReflectionEntry,
): TraceResult {
  let { row, column, direction } = getReflectionEntryState(size, entry);
  const visited: number[] = [];
  const maximumStepCount = size * size * 4;
  while (visited.length < maximumStepCount) {
    const cellIndex = row * size + column;
    visited.push(cellIndex);
    const leaving = getReflectionLeavingDirection(
      fromReflectionCellCode(cells[cellIndex] as ReflectionCellCode),
      direction,
    );
    if (leaving === null) {
      return {
        outcome: "absorb",
        distance: visited.length,
        cells: visited,
        exitIndex: null,
      };
    }
    ({ row, column } = stepReflectionPosition(row, column, leaving));
    const exit = getReflectionExitEntry(size, row, column);
    if (exit !== null) {
      return {
        outcome: isSameReflectionEntry(exit, entry) ? "reflect" : "exit",
        distance: visited.length,
        cells: visited,
        exitIndex: getReflectionEntryIndex(size, exit),
      };
    }
    direction = leaving as ReflectionDirection;
  }
  throw new Error("A Reflection laser must leave the board or be absorbed");
}

/**
 * 一致表示（`isReflectionClueMatch`）を見ながら試し置きで解く、推論をしない単純な戦略。難易度分析で「1本ずつ満たしていく試し置きで押し切れるか」を測る。
 *
 * 1. 一致していない外周ヒントのうち距離の短い順（同じなら外周の並び順）に1本を狙う。全て一致してピースが残っていれば、置き場所を探す。
 * 2. 狙った外周ヒントの今の光が通るマス（通る順）だけを動かす。空きマスには手持ちの各種類を置き（手持ちが無ければ光路の外の
 *    置いたピースを移し）、ピースのあるマスは手持ちの別の種類と入れ替えるか手持ちへ戻す。一度通った盤面に戻る手は打たない。
 * 3. 狙った外周ヒントを一致させ、一致を崩さない最初の手を打つ。無ければ、狙った外周ヒントを一致させる手のうち一致の数が最も多い
 *    最初の手、一致の数を増やす最初の手の順に探す。どれも無ければ次の外周ヒントを狙う。全て無ければ、一致の数を減らさない最初の手、
 *    それも無ければ一致の数が最も多く残る最初の手を打つ（崩してでも別の置き方を試す）。
 *
 * 手の順と狙う順を固定しているので、同じ入力には同じ結果を返す。
 */
export function traceReflectionTrialSolve({
  size,
  inventory,
  clues,
}: ReflectionTrialSolveInput): ReflectionTrialSolveTrace {
  const entries = listReflectionEntries(size);
  if (clues.length !== entries.length) {
    throw new RangeError("Reflection clues must cover every entry");
  }
  const cellCount = size * size;
  const cells = new Int8Array(cellCount);
  const stock = toStockCounts(inventory);
  const pieceCount = stock.reduce((total, count) => total + count, 0);
  const targetOrder = clues
    .map((_, index) => index)
    .sort(
      (left, right) =>
        clues[left]!.distance - clues[right]!.distance || left - right,
    );
  const allCells = Array.from({ length: cellCount }, (_, index) => index);

  function matchesClue(trace: TraceResult, index: number): boolean {
    return isReflectionClueMatch(clues, index, trace, trace.exitIndex);
  }

  let traces = entries.map((entry) => traceLaser(size, cells, entry));
  let matches = traces.map(matchesClue);
  let matchCount = matches.filter(Boolean).length;
  const visitedKeys = new Set([cells.join("")]);
  const trace: ReflectionTrialSolveTrace = {
    status: "move-limit-reached",
    moveCount: 0,
    cleanFixCount: 0,
    breakingFixCount: 0,
    brokenMatchCount: 0,
    advanceCount: 0,
    detourCount: 0,
    retryCount: 0,
  };

  function hasStock(): boolean {
    return pieceCodes.some((code) => (stock[code] ?? 0) > 0);
  }

  function listMoves(pathCells: readonly number[]): Move[] {
    const moves: Move[] = [];
    const listed = new Set<number>();
    const onPath = new Set(pathCells);
    const stockAvailable = hasStock();
    for (const cellIndex of pathCells) {
      if (listed.has(cellIndex)) {
        continue;
      }
      listed.add(cellIndex);
      const current = cells[cellIndex] as ReflectionCellCode;
      if (current === 0 && stockAvailable) {
        for (const code of pieceCodes) {
          if ((stock[code] ?? 0) > 0) {
            moves.push([{ cellIndex, code }]);
          }
        }
      } else if (current === 0) {
        for (const [from, code] of cells.entries()) {
          if (code !== 0 && !onPath.has(from)) {
            moves.push([
              { cellIndex, code: code as ReflectionCellCode },
              { cellIndex: from, code: 0 },
            ]);
          }
        }
      } else {
        for (const code of pieceCodes) {
          if (code !== current && (stock[code] ?? 0) > 0) {
            moves.push([{ cellIndex, code }]);
          }
        }
        moves.push([{ cellIndex, code: 0 }]);
      }
    }
    return moves;
  }

  function evaluateMove(move: Move): EvaluatedMove | null {
    const previous = move.map(({ cellIndex }) => cells[cellIndex]!);
    for (const { cellIndex, code } of move) {
      cells[cellIndex] = code;
    }
    const key = cells.join("");
    let evaluated: EvaluatedMove | null = null;
    if (!visitedKeys.has(key)) {
      const nextTraces = traces.map((current, index) =>
        move.some(({ cellIndex }) => current.cells.includes(cellIndex))
          ? traceLaser(size, cells, entries[index]!)
          : current,
      );
      const nextMatches = nextTraces.map(matchesClue);
      evaluated = {
        move,
        traces: nextTraces,
        matches: nextMatches,
        matchCount: nextMatches.filter(Boolean).length,
        key,
      };
    }
    move.forEach(({ cellIndex }, order) => {
      cells[cellIndex] = previous[order]!;
    });
    return evaluated;
  }

  function keepsMatches(evaluated: EvaluatedMove): boolean {
    return matches.every(
      (matched, index) => !matched || evaluated.matches[index],
    );
  }

  function chooseForTarget(
    target: number | null,
  ): { evaluated: EvaluatedMove; kind: MoveKind } | null {
    const moves = listMoves(target === null ? allCells : traces[target]!.cells);
    let breakingFix: EvaluatedMove | null = null;
    let advance: EvaluatedMove | null = null;
    for (const move of moves) {
      const evaluated = evaluateMove(move);
      if (evaluated === null) {
        continue;
      }
      const keeps = keepsMatches(evaluated);
      const fixes = target === null ? keeps : evaluated.matches[target]!;
      if (fixes && keeps) {
        return { evaluated, kind: "clean-fix" };
      }
      if (
        fixes &&
        (breakingFix === null || evaluated.matchCount > breakingFix.matchCount)
      ) {
        breakingFix = evaluated;
      }
      if (advance === null && evaluated.matchCount > matchCount) {
        advance = evaluated;
      }
    }
    if (breakingFix !== null) {
      return { evaluated: breakingFix, kind: "breaking-fix" };
    }
    return advance === null ? null : { evaluated: advance, kind: "advance" };
  }

  /** 一致の数を減らさない最初の手。無ければ、一致の数が最も多く残る最初の手（崩してでも別の置き方を試す）。 */
  function chooseDetour(
    targets: readonly (number | null)[],
  ): { evaluated: EvaluatedMove; kind: MoveKind } | null {
    let fallback: EvaluatedMove | null = null;
    for (const target of targets) {
      const moves = listMoves(
        target === null ? allCells : traces[target]!.cells,
      );
      for (const move of moves) {
        const evaluated = evaluateMove(move);
        if (evaluated === null) {
          continue;
        }
        if (evaluated.matchCount >= matchCount) {
          return { evaluated, kind: "detour" };
        }
        if (fallback === null || evaluated.matchCount > fallback.matchCount) {
          fallback = evaluated;
        }
      }
    }
    return fallback === null ? null : { evaluated: fallback, kind: "detour" };
  }

  function applyMove({ move }: EvaluatedMove): void {
    for (const { cellIndex, code } of move) {
      const previous = cells[cellIndex] as ReflectionCellCode;
      stock[previous] = (stock[previous] ?? 0) + 1;
      stock[code] = (stock[code] ?? 0) - 1;
      cells[cellIndex] = code;
    }
    stock[0] = 0;
  }

  const moveLimit = pieceCount * MOVES_PER_PIECE + EXTRA_MOVES;
  while (trace.moveCount < moveLimit) {
    if (!hasStock() && matchCount === clues.length) {
      trace.status = "solved";
      break;
    }
    const unmatched = targetOrder.filter((index) => !matches[index]);
    const targets: (number | null)[] =
      unmatched.length > 0 ? unmatched : [null];
    let chosen: { evaluated: EvaluatedMove; kind: MoveKind } | null = null;
    for (const target of targets) {
      chosen = chooseForTarget(target);
      if (chosen !== null) {
        break;
      }
    }
    chosen ??= chooseDetour(targets);
    if (chosen === null) {
      trace.status = "stuck";
      break;
    }
    const brokenMatchCount = matches.filter(
      (matched, index) => matched && !chosen.evaluated.matches[index],
    ).length;
    applyMove(chosen.evaluated);
    traces = [...chosen.evaluated.traces];
    matches = [...chosen.evaluated.matches];
    matchCount = chosen.evaluated.matchCount;
    visitedKeys.add(chosen.evaluated.key);
    trace.moveCount += 1;
    switch (chosen.kind) {
      case "clean-fix":
        trace.cleanFixCount += 1;
        break;
      case "breaking-fix":
        trace.breakingFixCount += 1;
        trace.brokenMatchCount += brokenMatchCount;
        break;
      case "advance":
        trace.advanceCount += 1;
        break;
      case "detour":
        trace.detourCount += 1;
        break;
    }
  }
  trace.retryCount = trace.breakingFixCount + trace.detourCount;
  return trace;
}
