import {
  getTakuzuLinePatternTile,
  isTakuzuLinePatternConsistent,
  listLegalTakuzuLinePatterns,
  readTakuzuLineKnowledge,
  type TakuzuLinePattern,
} from "@/games/takuzu/problem/generation/line-patterns";
import {
  getTakuzuLineCells,
  type TakuzuBoard,
} from "@/games/takuzu/puzzle/board";

/**
 * 初期配置に合う完成盤の数。`2` は「2つ以上」を表す。
 * 一意性の確認には 0 / 1 / 2以上 の区別で足りるので、2つ目を見つけた時点で探索を打ち切る。
 */
export type TakuzuSolutionCount = 0 | 1 | 2;

export type TakuzuSolutionSearchResult = {
  solutionCount: TakuzuSolutionCount;
  /** 最初に見つけた完成盤。解が無ければ `null`。 */
  firstSolution: TakuzuBoard | null;
};

type SearchOptions = {
  solutionLimit: 1 | 2;
  random?: () => number;
};

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

function listRowCandidates(
  givens: TakuzuBoard,
  random: (() => number) | undefined,
): TakuzuLinePattern[][] {
  const legalPatterns = listLegalTakuzuLinePatterns(givens.size);
  return Array.from({ length: givens.size }, function listCandidates(_, row) {
    const knowledge = readTakuzuLineKnowledge(
      getTakuzuLineCells(givens, { axis: "row", index: row }),
    );
    const candidates = legalPatterns.filter((pattern) =>
      isTakuzuLinePatternConsistent(pattern, knowledge),
    );
    return random ? shuffle(candidates, random) : candidates;
  });
}

function toColumnPatterns(
  rows: readonly TakuzuLinePattern[],
  size: number,
): TakuzuLinePattern[] {
  return Array.from({ length: size }, function toColumn(_, column) {
    let pattern = 0;
    rows.forEach(function addRow(rowPattern, row) {
      pattern |= ((rowPattern >> column) & 1) << row;
    });
    return pattern;
  });
}

function toBoard(
  rows: readonly TakuzuLinePattern[],
  size: number,
): TakuzuBoard {
  const cells = rows.flatMap(function toCells(rowPattern) {
    return Array.from({ length: size }, (_, column) =>
      getTakuzuLinePatternTile(rowPattern, column),
    );
  });
  return { size, cells };
}

/**
 * 行ごとに合法な並びを選び、列の個数・3連続・行の重複で枝を刈る。列の重複は全行が決まってから確かめる。
 */
function searchSolutions(
  givens: TakuzuBoard,
  { solutionLimit, random }: SearchOptions,
): TakuzuSolutionSearchResult {
  const { size } = givens;
  const half = size / 2;
  const fullMask = (1 << size) - 1;
  const rowCandidates = listRowCandidates(givens, random);
  const chosenRows: TakuzuLinePattern[] = [];
  const bTileCountByColumn = new Array<number>(size).fill(0);
  let solutionCount = 0;
  let firstSolution: TakuzuBoard | null = null;

  function fitsColumns(pattern: TakuzuLinePattern, row: number): boolean {
    if (row >= 2) {
      const twoAbove = chosenRows[row - 2]!;
      const oneAbove = chosenRows[row - 1]!;
      const repeatsBothAbove =
        ~((twoAbove ^ oneAbove) | (oneAbove ^ pattern)) & fullMask;
      if (repeatsBothAbove !== 0) {
        return false;
      }
    }
    for (let column = 0; column < size; column += 1) {
      const bTileCount =
        (bTileCountByColumn[column] ?? 0) + ((pattern >> column) & 1);
      const aTileCount = row + 1 - bTileCount;
      if (bTileCount > half || aTileCount > half) {
        return false;
      }
    }
    return true;
  }

  function placeRow(pattern: TakuzuLinePattern, sign: 1 | -1): void {
    for (let column = 0; column < size; column += 1) {
      bTileCountByColumn[column] =
        (bTileCountByColumn[column] ?? 0) + sign * ((pattern >> column) & 1);
    }
  }

  function visit(row: number): void {
    if (row === size) {
      const columns = toColumnPatterns(chosenRows, size);
      if (new Set(columns).size === size) {
        solutionCount += 1;
        firstSolution ??= toBoard(chosenRows, size);
      }
      return;
    }
    for (const pattern of rowCandidates[row]!) {
      if (chosenRows.includes(pattern) || !fitsColumns(pattern, row)) {
        continue;
      }
      chosenRows.push(pattern);
      placeRow(pattern, 1);
      visit(row + 1);
      placeRow(pattern, -1);
      chosenRows.pop();
      if (solutionCount >= solutionLimit) {
        return;
      }
    }
  }

  visit(0);
  return {
    solutionCount: Math.min(solutionCount, 2) as TakuzuSolutionCount,
    firstSolution,
  };
}

/** 初期配置に合う完成盤を 0 / 1 / 2以上 で数える。一意性の確認に使う。 */
export function countTakuzuSolutions(
  givens: TakuzuBoard,
): TakuzuSolutionSearchResult {
  return searchSolutions(givens, { solutionLimit: 2 });
}

/** 初期配置に合う完成盤を、`random` で決まる順に探して1つ返す。完成盤の生成に使う。 */
export function findRandomTakuzuSolution(
  givens: TakuzuBoard,
  random: () => number,
): TakuzuBoard | null {
  return searchSolutions(givens, { solutionLimit: 1, random }).firstSolution;
}
