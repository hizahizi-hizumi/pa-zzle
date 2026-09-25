import {
  isTakuzuLinePatternConsistent,
  listLegalTakuzuLinePatterns,
  readTakuzuLineKnowledge,
  type TakuzuLinePattern,
} from "@/games/takuzu/problem/generation/line-patterns";
import {
  getTakuzuLineCellIndices,
  listTakuzuLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";

/**
 * 人間向けの手筋。並び順が浅い順。
 * - `adjacency`（A 隣接・挟み）: 3マスの並びに同じタイルが2つあれば、残る1マスは反対のタイル。
 * - `count-completion`（B 個数の完成）: 行・列に片方のタイルが半分そろえば、残りの空きマスは反対のタイル。
 * - `single-remaining`（C 残り1個）: 片方のタイルが残り1個の行・列で、その1個を置ける位置を読んで確定する。
 * - `duplicate-avoidance`（D 重複の回避）: C と同じ行・列で、完成済みの行（列）と同じ並びになる置き方も除いて確定する。
 * - `general-line`（E 一般の行候補）: 両方のタイルが残り2個以上の行・列で、ルールを満たす並び（完成済みの行・列との重複を除く）を読み比べて確定する。
 *
 * どれも1本の行・列の中だけで読む推論で、2本以上の行・列を組み合わせる推論は扱わない。
 */
export const takuzuTechniques = [
  "adjacency",
  "count-completion",
  "single-remaining",
  "duplicate-avoidance",
  "general-line",
] as const;

export type TakuzuTechnique = (typeof takuzuTechniques)[number];

export type TakuzuDeduction = {
  cellIndex: number;
  tile: TakuzuTile;
};

/**
 * 1ラウンドで同時に確定・適用したマスの記録。
 * ラウンドは、その局面で確定を与える最も浅い手筋を探し、その手筋で確定するマスをまとめて置く。
 * - `sourceCount`: 確定を与えた場所の数。隣接・挟みでは3マスの並び、それ以外では行・列を1か所と数える。
 *   局面のどこに次の一手があるかの多さで、見つけやすさを表す。
 * - `emptyCellCount`: ラウンドの前に残っていた空きマスの数。
 * - `sourceLineEmptyCellCount`: 行・列を読む手筋（C・D・E）で、確定を与えた行・列の空きマス数の最小値。読む範囲の狭さを表す。
 * - `requiresDuplicateAvoidance`: 完成済みの行・列との重複を除かないと確定しなかった。E のラウンドで D と同じ読みが要るかを表す。
 */
export type TakuzuHumanSolveRound = {
  technique: TakuzuTechnique;
  deductions: readonly TakuzuDeduction[];
  sourceCount: number;
  emptyCellCount: number;
  sourceLineEmptyCellCount: number | null;
  requiresDuplicateAvoidance: boolean;
};

/**
 * - `solved`: 許した手筋だけで全マスを埋めた。手筋はどれも健全なので、解は唯一で推測も要らない。
 * - `stalled`: 許した手筋では確定できるマスが無くなった。
 * - `contradiction`: ルールを満たす並びが入らない行・列か、同じ並びで完成した行どうし・列どうしが現れた。初期配置に解が無い。
 */
export type TakuzuHumanSolveResult = {
  status: "solved" | "stalled" | "contradiction";
  rounds: readonly TakuzuHumanSolveRound[];
  board: TakuzuBoard;
};

export type TakuzuHumanSolverOptions = {
  /** 使ってよい手筋。省略するとすべての手筋を使う。問題生成で手筋の上限を決めるときに使う。 */
  techniques?: readonly TakuzuTechnique[];
};

type FoundDeductions = {
  status: "found";
  tileByCellIndex: Map<number, TakuzuTile>;
  sourceCount: number;
  sourceLineEmptyCellCount: number | null;
  requiresDuplicateAvoidance: boolean;
};

type TechniqueFindings = { status: "contradiction" } | FoundDeductions;

type SolveState = {
  size: number;
  cells: TakuzuCell[];
  lines: readonly TakuzuLine[];
  cellIndicesByLine: readonly (readonly number[])[];
};

const oppositeTile = { a: "b", b: "a" } as const satisfies Record<
  TakuzuTile,
  TakuzuTile
>;

function createFindings(): FoundDeductions {
  return {
    status: "found",
    tileByCellIndex: new Map(),
    sourceCount: 0,
    sourceLineEmptyCellCount: null,
    requiresDuplicateAvoidance: false,
  };
}

/** 同じマスに反対のタイルが求まったら `false` を返す。初期配置に解が無いときだけ起きる。 */
function recordDeduction(
  findings: FoundDeductions,
  cellIndex: number,
  tile: TakuzuTile,
): boolean {
  const recordedTile = findings.tileByCellIndex.get(cellIndex);
  findings.tileByCellIndex.set(cellIndex, tile);
  return recordedTile === undefined || recordedTile === tile;
}

function readLineCells(state: SolveState, lineIndex: number): TakuzuCell[] {
  return state.cellIndicesByLine[lineIndex]!.map(
    (cellIndex) => state.cells[cellIndex] ?? null,
  );
}

function findAdjacency(state: SolveState): TechniqueFindings {
  const findings = createFindings();
  for (const cellIndices of state.cellIndicesByLine) {
    for (let start = 0; start + 2 < cellIndices.length; start += 1) {
      const window = cellIndices.slice(start, start + 3);
      const tiles = window.map((cellIndex) => state.cells[cellIndex] ?? null);
      const emptyPositions = tiles.flatMap((tile, position) =>
        tile === null ? [position] : [],
      );
      const placedTiles = tiles.filter((tile) => tile !== null);
      const [firstTile, secondTile] = placedTiles;
      if (
        emptyPositions.length !== 1 ||
        firstTile === undefined ||
        firstTile !== secondTile
      ) {
        continue;
      }
      const cellIndex = window[emptyPositions[0]!]!;
      if (!recordDeduction(findings, cellIndex, oppositeTile[firstTile])) {
        return { status: "contradiction" };
      }
      findings.sourceCount += 1;
    }
  }
  return findings;
}

function findCountCompletion(state: SolveState): TechniqueFindings {
  const findings = createFindings();
  const half = state.size / 2;
  for (const [lineIndex, cellIndices] of state.cellIndicesByLine.entries()) {
    const cells = readLineCells(state, lineIndex);
    const completedTile = (["a", "b"] as const).find(
      (tile) => cells.filter((cell) => cell === tile).length === half,
    );
    if (completedTile === undefined || !cells.includes(null)) {
      continue;
    }
    for (const [position, cell] of cells.entries()) {
      const cellIndex = cellIndices[position]!;
      if (
        cell === null &&
        !recordDeduction(findings, cellIndex, oppositeTile[completedTile])
      ) {
        return { status: "contradiction" };
      }
    }
    findings.sourceCount += 1;
  }
  return findings;
}

type LineReading = "single-remaining" | "general";

function countRemainingMinorityTiles(
  cells: readonly TakuzuCell[],
  half: number,
): number {
  return Math.min(
    half - cells.filter((cell) => cell === "a").length,
    half - cells.filter((cell) => cell === "b").length,
  );
}

function listCompletedLinePatterns(
  state: SolveState,
  axis: TakuzuLine["axis"],
): Set<TakuzuLinePattern> {
  const completedPatterns = new Set<TakuzuLinePattern>();
  state.lines.forEach(function addCompleted(line, lineIndex) {
    const cells = readLineCells(state, lineIndex);
    if (line.axis === axis && !cells.includes(null)) {
      completedPatterns.add(readTakuzuLineKnowledge(cells).knownValue);
    }
  });
  return completedPatterns;
}

/** 候補の並びすべてで同じタイルになる空きマスを返す。候補が無ければ `null`。 */
function intersectCandidates(
  candidates: readonly TakuzuLinePattern[],
  cells: readonly TakuzuCell[],
): Map<number, TakuzuTile> | null {
  if (candidates.length === 0) {
    return null;
  }
  const alwaysB = candidates.reduce((common, pattern) => common & pattern);
  const alwaysA = candidates.reduce((common, pattern) => common & ~pattern, -1);
  const tileByPosition = new Map<number, TakuzuTile>();
  cells.forEach(function readPosition(cell, position) {
    if (cell !== null) {
      return;
    }
    if ((alwaysB >> position) & 1) {
      tileByPosition.set(position, "b");
    } else if ((alwaysA >> position) & 1) {
      tileByPosition.set(position, "a");
    }
  });
  return tileByPosition;
}

function findLineReading(
  state: SolveState,
  reading: LineReading,
  excludesCompletedLines: boolean,
): TechniqueFindings {
  const findings = createFindings();
  const half = state.size / 2;
  const legalPatterns = listLegalTakuzuLinePatterns(state.size);
  const completedPatternsByAxis = {
    row: listCompletedLinePatterns(state, "row"),
    column: listCompletedLinePatterns(state, "column"),
  };

  for (const [lineIndex, line] of state.lines.entries()) {
    const cells = readLineCells(state, lineIndex);
    const remainingMinority = countRemainingMinorityTiles(cells, half);
    const isTargetLine =
      reading === "single-remaining"
        ? remainingMinority === 1
        : remainingMinority >= 2;
    if (!isTargetLine) {
      continue;
    }
    const knowledge = readTakuzuLineKnowledge(cells);
    const consistentPatterns = legalPatterns.filter((pattern) =>
      isTakuzuLinePatternConsistent(pattern, knowledge),
    );
    const completedPatterns = completedPatternsByAxis[line.axis];
    const candidates = excludesCompletedLines
      ? consistentPatterns.filter((pattern) => !completedPatterns.has(pattern))
      : consistentPatterns;
    const tileByPosition = intersectCandidates(candidates, cells);
    if (tileByPosition === null) {
      return { status: "contradiction" };
    }
    if (tileByPosition.size === 0) {
      continue;
    }
    const emptyCellCount = cells.filter((cell) => cell === null).length;
    for (const [position, tile] of tileByPosition) {
      const cellIndex = state.cellIndicesByLine[lineIndex]![position]!;
      if (!recordDeduction(findings, cellIndex, tile)) {
        return { status: "contradiction" };
      }
    }
    findings.sourceCount += 1;
    findings.sourceLineEmptyCellCount = Math.min(
      findings.sourceLineEmptyCellCount ?? emptyCellCount,
      emptyCellCount,
    );
    if (
      excludesCompletedLines &&
      intersectCandidates(consistentPatterns, cells)?.size !==
        tileByPosition.size
    ) {
      findings.requiresDuplicateAvoidance = true;
    }
  }
  return findings;
}

const findTechnique = {
  adjacency: findAdjacency,
  "count-completion": findCountCompletion,
  "single-remaining": (state) =>
    findLineReading(state, "single-remaining", false),
  "duplicate-avoidance": (state) =>
    findLineReading(state, "single-remaining", true),
  "general-line": (state) => findLineReading(state, "general", true),
} as const satisfies Record<
  TakuzuTechnique,
  (state: SolveState) => TechniqueFindings
>;

function createSolveState(givens: TakuzuBoard): SolveState {
  const lines = listTakuzuLines(givens.size);
  return {
    size: givens.size,
    cells: [...givens.cells],
    lines,
    cellIndicesByLine: lines.map((line) =>
      getTakuzuLineCellIndices(givens.size, line),
    ),
  };
}

/** ルールを満たす並びが1つも入らない行・列か、同じ並びで完成した行どうし・列どうしがある。 */
function hasBrokenLine(state: SolveState): boolean {
  const legalPatterns = listLegalTakuzuLinePatterns(state.size);
  const completedPatternKeys = new Set<string>();
  for (const [lineIndex, line] of state.lines.entries()) {
    const cells = readLineCells(state, lineIndex);
    const knowledge = readTakuzuLineKnowledge(cells);
    const hasCandidate = legalPatterns.some((pattern) =>
      isTakuzuLinePatternConsistent(pattern, knowledge),
    );
    if (!hasCandidate) {
      return true;
    }
    if (cells.includes(null)) {
      continue;
    }
    const patternKey = `${line.axis}:${knowledge.knownValue}`;
    if (completedPatternKeys.has(patternKey)) {
      return true;
    }
    completedPatternKeys.add(patternKey);
  }
  return false;
}

function countEmptyCells(cells: readonly TakuzuCell[]): number {
  return cells.filter((cell) => cell === null).length;
}

/**
 * 初期配置から、各局面で最も浅い手筋を探して確定マスをまとめて置くことを繰り返す。
 * 解の一意性は確かめない。解き切れたときだけ、その盤面が唯一の解になる。
 */
export function traceTakuzuHumanSolve(
  givens: TakuzuBoard,
  options: TakuzuHumanSolverOptions = {},
): TakuzuHumanSolveResult {
  const allowedTechniques = new Set(options.techniques ?? takuzuTechniques);
  const techniques = takuzuTechniques.filter((technique) =>
    allowedTechniques.has(technique),
  );
  const state = createSolveState(givens);
  const rounds: TakuzuHumanSolveRound[] = [];

  function finish(
    status: TakuzuHumanSolveResult["status"],
  ): TakuzuHumanSolveResult {
    return { status, rounds, board: { size: state.size, cells: state.cells } };
  }

  while (!hasBrokenLine(state)) {
    if (countEmptyCells(state.cells) === 0) {
      return finish("solved");
    }
    let appliedRound: TakuzuHumanSolveRound | null = null;
    for (const technique of techniques) {
      const findings = findTechnique[technique](state);
      if (findings.status === "contradiction") {
        return finish("contradiction");
      }
      if (findings.tileByCellIndex.size === 0) {
        continue;
      }
      appliedRound = {
        technique,
        deductions: [...findings.tileByCellIndex]
          .map(([cellIndex, tile]) => ({ cellIndex, tile }))
          .sort((left, right) => left.cellIndex - right.cellIndex),
        sourceCount: findings.sourceCount,
        emptyCellCount: countEmptyCells(state.cells),
        sourceLineEmptyCellCount: findings.sourceLineEmptyCellCount,
        requiresDuplicateAvoidance: findings.requiresDuplicateAvoidance,
      };
      break;
    }
    if (appliedRound === null) {
      return finish("stalled");
    }
    for (const { cellIndex, tile } of appliedRound.deductions) {
      state.cells[cellIndex] = tile;
    }
    rounds.push(appliedRound);
  }
  return finish("contradiction");
}

export function getTakuzuTechniqueDepth(technique: TakuzuTechnique): number {
  return takuzuTechniques.indexOf(technique);
}

export const _private = {
  createSolveState,
  findAdjacency,
  findCountCompletion,
  findLineReading,
};
