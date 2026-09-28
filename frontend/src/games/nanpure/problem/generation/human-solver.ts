import {
  isNanpurePlacementTechnique,
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";
import {
  assertNanpureBoard,
  NANPURE_BLOCK_SIZE,
  NANPURE_CELL_COUNT,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureCell,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";

export type NanpurePlacement = {
  cellIndex: number;
  digit: NanpureDigit;
};

export type NanpureElimination = {
  cellIndex: number;
  digit: NanpureDigit;
};

/**
 * 1ラウンドの記録。ラウンドは、その局面で進められる最も浅い手筋を探して適用する。
 * - 数字を置く手筋では、その手筋で置ける数字をまとめて置く（`placements`）。
 * - 候補を消す手筋では、見つけた最初の1か所の形だけを使って候補を消す（`eliminations`）。
 *   消したあとは、また最も浅い手筋から探し直す。
 * - `availablePlacementCount`: ラウンドの前に、使ってよい数字を置く手筋のどれかで置けた異なる「マスと数字」の数。
 *   次の一手の見つけやすさを表す。候補を消す手筋のラウンドでは 0（置ける数字が無いから深い手筋に進んだ）。
 * - `emptyCellCount`: ラウンドの前に残っていた空きマスの数。
 */
export type NanpureHumanSolveRound = {
  technique: NanpureTechnique;
  placements: readonly NanpurePlacement[];
  eliminations: readonly NanpureElimination[];
  availablePlacementCount: number;
  emptyCellCount: number;
};

/**
 * - `solved`: 許した手筋だけで全マスを埋めた。手筋はどれも健全なので、解は唯一で推測も要らない。
 * - `stalled`: 許した手筋では進められなくなった。
 * - `contradiction`: 同じ単位に同じ数字が重なるか、候補が無くなるマスや置き場所が無くなる数字が現れた。初期配置に解が無い。
 */
export type NanpureHumanSolveResult = {
  status: "solved" | "stalled" | "contradiction";
  rounds: readonly NanpureHumanSolveRound[];
  board: NanpureBoard;
};

export type NanpureHumanSolverOptions = {
  /** 使ってよい手筋。省略するとすべての手筋を使う。問題生成で手筋の上限を決めるときに使う。 */
  techniques?: readonly NanpureTechnique[];
};

type SolveState = {
  cells: Uint8Array;
  candidates: Uint16Array;
};

type Finding =
  | { kind: "placements"; placements: NanpurePlacement[] }
  | { kind: "eliminations"; eliminations: NanpureElimination[] };

const allDigitsMask = 0b11_1111_1110;

function listRowCells(row: number): number[] {
  return Array.from(
    { length: NANPURE_SIZE },
    (_, column) => row * NANPURE_SIZE + column,
  );
}

function listColumnCells(column: number): number[] {
  return Array.from(
    { length: NANPURE_SIZE },
    (_, row) => row * NANPURE_SIZE + column,
  );
}

function listBlockCells(block: number): number[] {
  const top = Math.floor(block / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE;
  const left = (block % NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE;
  return Array.from(
    { length: NANPURE_SIZE },
    (_, offset) =>
      (top + Math.floor(offset / NANPURE_BLOCK_SIZE)) * NANPURE_SIZE +
      left +
      (offset % NANPURE_BLOCK_SIZE),
  );
}

const rowUnits = Array.from({ length: NANPURE_SIZE }, (_, index) =>
  listRowCells(index),
);
const columnUnits = Array.from({ length: NANPURE_SIZE }, (_, index) =>
  listColumnCells(index),
);
const blockUnits = Array.from({ length: NANPURE_SIZE }, (_, index) =>
  listBlockCells(index),
);
const lineUnits = [...rowUnits, ...columnUnits];
/** 数字の組・場所の組を探す単位の順。ブロック、行、列の順に見る。 */
const allUnits = [...blockUnits, ...rowUnits, ...columnUnits];

function rowOf(cellIndex: number): number {
  return Math.floor(cellIndex / NANPURE_SIZE);
}

function columnOf(cellIndex: number): number {
  return cellIndex % NANPURE_SIZE;
}

function blockOf(cellIndex: number): number {
  return (
    Math.floor(rowOf(cellIndex) / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE +
    Math.floor(columnOf(cellIndex) / NANPURE_BLOCK_SIZE)
  );
}

const peersByCell: readonly (readonly number[])[] = Array.from(
  { length: NANPURE_CELL_COUNT },
  (_, cellIndex) =>
    Array.from({ length: NANPURE_CELL_COUNT }, (_, other) => other).filter(
      (other) => other !== cellIndex && areRelated(cellIndex, other),
    ),
);

function areRelated(left: number, right: number): boolean {
  return (
    rowOf(left) === rowOf(right) ||
    columnOf(left) === columnOf(right) ||
    blockOf(left) === blockOf(right)
  );
}

function sees(left: number, right: number): boolean {
  return left !== right && areRelated(left, right);
}

function bitOf(digit: number): number {
  return 1 << digit;
}

function countBits(mask: number): number {
  let count = 0;
  for (let remaining = mask; remaining !== 0; remaining &= remaining - 1) {
    count += 1;
  }
  return count;
}

function digitsOf(mask: number): NanpureDigit[] {
  const digits: NanpureDigit[] = [];
  for (let digit = 1; digit <= NANPURE_SIZE; digit += 1) {
    if ((mask & bitOf(digit)) !== 0) {
      digits.push(digit as NanpureDigit);
    }
  }
  return digits;
}

function lowestDigitOf(mask: number): NanpureDigit {
  return digitsOf(mask)[0]!;
}

/** 大きさ `size` の組み合わせを、添字の辞書順に列挙する。 */
function forEachCombination<T>(
  values: readonly T[],
  size: number,
  visit: (combination: readonly T[]) => boolean,
): boolean {
  const combination: T[] = [];
  function extend(start: number): boolean {
    if (combination.length === size) {
      return visit(combination);
    }
    for (
      let index = start;
      index <= values.length - (size - combination.length);
      index += 1
    ) {
      combination.push(values[index]!);
      if (extend(index + 1)) {
        return true;
      }
      combination.pop();
    }
    return false;
  }
  return extend(0);
}

function createState(board: NanpureBoard): SolveState | null {
  const state: SolveState = {
    cells: new Uint8Array(NANPURE_CELL_COUNT),
    candidates: new Uint16Array(NANPURE_CELL_COUNT).fill(allDigitsMask),
  };
  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
    const digit = board[cellIndex];
    if (
      digit !== null &&
      digit !== undefined &&
      !place(state, cellIndex, digit)
    ) {
      return null;
    }
  }
  return state;
}

/** 数字を置き、同じ行・列・ブロックのマスからその数字の候補を消す。置けない数字なら `false`。 */
function place(
  state: SolveState,
  cellIndex: number,
  digit: NanpureDigit,
): boolean {
  const bit = bitOf(digit);
  if (
    state.cells[cellIndex] !== 0 ||
    (state.candidates[cellIndex]! & bit) === 0
  ) {
    return false;
  }
  state.cells[cellIndex] = digit;
  state.candidates[cellIndex] = 0;
  for (const peer of peersByCell[cellIndex]!) {
    state.candidates[peer]! &= ~bit;
  }
  return true;
}

function unitPlacedMask(state: SolveState, unit: readonly number[]): number {
  let mask = 0;
  for (const cellIndex of unit) {
    const digit = state.cells[cellIndex]!;
    if (digit !== 0) {
      mask |= bitOf(digit);
    }
  }
  return mask;
}

/** 単位の中で、まだ置かれていない数字の候補があるマス。 */
function cellsWithCandidate(
  state: SolveState,
  unit: readonly number[],
  digit: number,
): number[] {
  return unit.filter(
    (cellIndex) => (state.candidates[cellIndex]! & bitOf(digit)) !== 0,
  );
}

function hasContradiction(state: SolveState): boolean {
  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
    if (state.cells[cellIndex] === 0 && state.candidates[cellIndex] === 0) {
      return true;
    }
  }
  for (const unit of allUnits) {
    const placed = unitPlacedMask(state, unit);
    let available = 0;
    for (const cellIndex of unit) {
      available |= state.candidates[cellIndex]!;
    }
    if ((placed | available) !== allDigitsMask) {
      return true;
    }
  }
  return false;
}

function countEmptyCells(state: SolveState): number {
  return state.cells.filter((digit) => digit === 0).length;
}

function uniquePlacements(placements: NanpurePlacement[]): NanpurePlacement[] {
  const seen = new Set<number>();
  return placements.filter(({ cellIndex }) => {
    if (seen.has(cellIndex)) {
      return false;
    }
    seen.add(cellIndex);
    return true;
  });
}

function findFullHouses(state: SolveState): NanpurePlacement[] {
  const placements: NanpurePlacement[] = [];
  for (const unit of allUnits) {
    const emptyCells = unit.filter((cellIndex) => state.cells[cellIndex] === 0);
    if (emptyCells.length !== 1) {
      continue;
    }
    const missing = allDigitsMask & ~unitPlacedMask(state, unit);
    if (countBits(missing) === 1) {
      placements.push({
        cellIndex: emptyCells[0]!,
        digit: lowestDigitOf(missing),
      });
    }
  }
  return uniquePlacements(placements);
}

function findHiddenSingles(
  state: SolveState,
  units: readonly (readonly number[])[],
): NanpurePlacement[] {
  const placements: NanpurePlacement[] = [];
  for (const unit of units) {
    const placed = unitPlacedMask(state, unit);
    for (let digit = 1; digit <= NANPURE_SIZE; digit += 1) {
      if ((placed & bitOf(digit)) !== 0) {
        continue;
      }
      const cells = cellsWithCandidate(state, unit, digit);
      if (cells.length === 1) {
        placements.push({ cellIndex: cells[0]!, digit: digit as NanpureDigit });
      }
    }
  }
  return uniquePlacements(placements);
}

function findNakedSingles(state: SolveState): NanpurePlacement[] {
  const placements: NanpurePlacement[] = [];
  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
    const mask = state.candidates[cellIndex]!;
    if (state.cells[cellIndex] === 0 && countBits(mask) === 1) {
      placements.push({ cellIndex, digit: lowestDigitOf(mask) });
    }
  }
  return placements;
}

function eliminationsOf(
  state: SolveState,
  cellIndices: readonly number[],
  mask: number,
): NanpureElimination[] {
  const eliminations: NanpureElimination[] = [];
  for (const cellIndex of cellIndices) {
    for (const digit of digitsOf(state.candidates[cellIndex]! & mask)) {
      eliminations.push({ cellIndex, digit });
    }
  }
  return eliminations;
}

/** ブロックの中で1本の行・列に並ぶ候補（ポインティング）と、行・列の中で1つのブロックに収まる候補（クレーミング）。 */
function findLockedCandidates(state: SolveState): NanpureElimination[] {
  for (let digit = 1; digit <= NANPURE_SIZE; digit += 1) {
    for (const block of blockUnits) {
      const cells = cellsWithCandidate(state, block, digit);
      if (cells.length === 0) {
        continue;
      }
      for (const [lineOf, units] of [
        [rowOf, rowUnits],
        [columnOf, columnUnits],
      ] as const) {
        const line = lineOf(cells[0]!);
        if (cells.every((cellIndex) => lineOf(cellIndex) === line)) {
          const targets = units[line]!.filter(
            (cellIndex) => !block.includes(cellIndex),
          );
          const eliminations = eliminationsOf(state, targets, bitOf(digit));
          if (eliminations.length > 0) {
            return eliminations;
          }
        }
      }
    }
    for (const line of lineUnits) {
      const cells = cellsWithCandidate(state, line, digit);
      if (cells.length === 0) {
        continue;
      }
      const block = blockOf(cells[0]!);
      if (cells.every((cellIndex) => blockOf(cellIndex) === block)) {
        const targets = blockUnits[block]!.filter(
          (cellIndex) => !line.includes(cellIndex),
        );
        const eliminations = eliminationsOf(state, targets, bitOf(digit));
        if (eliminations.length > 0) {
          return eliminations;
        }
      }
    }
  }
  return [];
}

function findNakedSubset(
  state: SolveState,
  size: number,
): NanpureElimination[] {
  let found: NanpureElimination[] = [];
  for (const unit of allUnits) {
    const members = unit.filter((cellIndex) => {
      const count = countBits(state.candidates[cellIndex]!);
      return state.cells[cellIndex] === 0 && count >= 2 && count <= size;
    });
    const hit = forEachCombination(members, size, (combination) => {
      let union = 0;
      for (const cellIndex of combination) {
        union |= state.candidates[cellIndex]!;
      }
      if (countBits(union) !== size) {
        return false;
      }
      const targets = unit.filter(
        (cellIndex) => !combination.includes(cellIndex),
      );
      found = eliminationsOf(state, targets, union);
      return found.length > 0;
    });
    if (hit) {
      return found;
    }
  }
  return [];
}

function findHiddenSubset(
  state: SolveState,
  size: number,
): NanpureElimination[] {
  let found: NanpureElimination[] = [];
  for (const unit of allUnits) {
    const placed = unitPlacedMask(state, unit);
    const digits = digitsOf(allDigitsMask & ~placed).filter((digit) => {
      const count = cellsWithCandidate(state, unit, digit).length;
      return count >= 2 && count <= size;
    });
    const hit = forEachCombination(digits, size, (combination) => {
      const cells = new Set<number>();
      let digitsMask = 0;
      for (const digit of combination) {
        digitsMask |= bitOf(digit);
        for (const cellIndex of cellsWithCandidate(state, unit, digit)) {
          cells.add(cellIndex);
        }
      }
      if (cells.size !== size) {
        return false;
      }
      found = eliminationsOf(
        state,
        [...cells].sort((left, right) => left - right),
        allDigitsMask & ~digitsMask,
      );
      return found.length > 0;
    });
    if (hit) {
      return found;
    }
  }
  return [];
}

/** ある数字の候補が `size` 本の行（列）で同じ `size` 本の列（行）に収まる形。 */
function findFish(state: SolveState, size: number): NanpureElimination[] {
  let found: NanpureElimination[] = [];
  for (let digit = 1; digit <= NANPURE_SIZE; digit += 1) {
    for (const [baseUnits, coverUnits, coverOf] of [
      [rowUnits, columnUnits, columnOf],
      [columnUnits, rowUnits, rowOf],
    ] as const) {
      const bases = baseUnits
        .map((unit) => ({
          unit,
          cells: cellsWithCandidate(state, unit, digit),
        }))
        .filter(({ cells }) => cells.length >= 2 && cells.length <= size);
      const hit = forEachCombination(bases, size, (combination) => {
        const covers = new Set<number>();
        for (const { cells } of combination) {
          for (const cellIndex of cells) {
            covers.add(coverOf(cellIndex));
          }
        }
        if (covers.size !== size) {
          return false;
        }
        const baseCells = new Set(combination.flatMap(({ unit }) => unit));
        const targets = [...covers]
          .sort((left, right) => left - right)
          .flatMap((cover) => coverUnits[cover]!)
          .filter((cellIndex) => !baseCells.has(cellIndex))
          .sort((left, right) => left - right);
        found = eliminationsOf(state, targets, bitOf(digit));
        return found.length > 0;
      });
      if (hit) {
        return found;
      }
    }
  }
  return [];
}

function cellsWithCandidateCount(state: SolveState, count: number): number[] {
  const cells: number[] = [];
  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
    if (
      state.cells[cellIndex] === 0 &&
      countBits(state.candidates[cellIndex]!) === count
    ) {
      cells.push(cellIndex);
    }
  }
  return cells;
}

/** 候補を消す先: `wing` のマスすべてから見えるマス（`wing` 自身を除く）。 */
function eliminationsSeenByAll(
  state: SolveState,
  wing: readonly number[],
  digit: number,
): NanpureElimination[] {
  const targets = peersByCell[wing[0]!]!.filter(
    (cellIndex) =>
      !wing.includes(cellIndex) &&
      wing.every((member) => sees(member, cellIndex)),
  );
  return eliminationsOf(state, targets, bitOf(digit));
}

/**
 * XY-Wing: 候補 {x,y} の軸と、軸から見える候補 {x,z}・{y,z} の2マス。どちらの場合も片方のマスが z になるので、両方から見えるマスの z を消す。
 * XYZ-Wing: 候補 {x,y,z} の軸と、軸から見える {x,z}・{y,z} の2マス。3マスのどれかが z になるので、3マスすべてから見えるマスの z を消す。
 */
function findWing(
  state: SolveState,
  pivotCandidateCount: 2 | 3,
): NanpureElimination[] {
  const bivalueCells = cellsWithCandidateCount(state, 2);
  for (const pivot of cellsWithCandidateCount(state, pivotCandidateCount)) {
    const pivotMask = state.candidates[pivot]!;
    const pincers = bivalueCells.filter((cellIndex) => {
      if (!sees(pivot, cellIndex)) {
        return false;
      }
      const shared = countBits(state.candidates[cellIndex]! & pivotMask);
      return pivotCandidateCount === 2 ? shared === 1 : shared === 2;
    });
    for (const [firstIndex, first] of pincers.entries()) {
      for (const second of pincers.slice(firstIndex + 1)) {
        const firstMask = state.candidates[first]!;
        const secondMask = state.candidates[second]!;
        if (firstMask === secondMask) {
          continue;
        }
        const common = firstMask & secondMask;
        if (countBits(common) !== 1) {
          continue;
        }
        if (pivotCandidateCount === 2) {
          if (
            (common & pivotMask) !== 0 ||
            ((firstMask | secondMask) & pivotMask) !== pivotMask
          ) {
            continue;
          }
        } else if ((firstMask | secondMask) !== pivotMask) {
          continue;
        }
        const wing =
          pivotCandidateCount === 2 ? [first, second] : [pivot, first, second];
        const eliminations = eliminationsSeenByAll(
          state,
          wing,
          lowestDigitOf(common),
        );
        if (eliminations.length > 0) {
          return eliminations;
        }
      }
    }
  }
  return [];
}

function findByTechnique(
  state: SolveState,
  technique: NanpureTechnique,
): Finding {
  switch (technique) {
    case "full-house":
      return { kind: "placements", placements: findFullHouses(state) };
    case "hidden-single-block":
      return {
        kind: "placements",
        placements: findHiddenSingles(state, blockUnits),
      };
    case "hidden-single-line":
      return {
        kind: "placements",
        placements: findHiddenSingles(state, lineUnits),
      };
    case "naked-single":
      return { kind: "placements", placements: findNakedSingles(state) };
    case "locked-candidates":
      return {
        kind: "eliminations",
        eliminations: findLockedCandidates(state),
      };
    case "naked-pair":
      return { kind: "eliminations", eliminations: findNakedSubset(state, 2) };
    case "hidden-pair":
      return { kind: "eliminations", eliminations: findHiddenSubset(state, 2) };
    case "naked-triple":
      return { kind: "eliminations", eliminations: findNakedSubset(state, 3) };
    case "hidden-triple":
      return { kind: "eliminations", eliminations: findHiddenSubset(state, 3) };
    case "x-wing":
      return { kind: "eliminations", eliminations: findFish(state, 2) };
    case "swordfish":
      return { kind: "eliminations", eliminations: findFish(state, 3) };
    case "xy-wing":
      return { kind: "eliminations", eliminations: findWing(state, 2) };
    case "xyz-wing":
      return { kind: "eliminations", eliminations: findWing(state, 3) };
  }
}

function isEmptyFinding(finding: Finding): boolean {
  return finding.kind === "placements"
    ? finding.placements.length === 0
    : finding.eliminations.length === 0;
}

function countAvailablePlacements(
  state: SolveState,
  techniques: readonly NanpureTechnique[],
): number {
  const keys = new Set<number>();
  for (const technique of techniques) {
    if (!isNanpurePlacementTechnique(technique)) {
      continue;
    }
    const finding = findByTechnique(state, technique);
    if (finding.kind === "placements") {
      for (const { cellIndex, digit } of finding.placements) {
        keys.add(cellIndex * 10 + digit);
      }
    }
  }
  return keys.size;
}

function toBoard(state: SolveState): NanpureBoard {
  return Array.from(
    state.cells,
    (digit): NanpureCell => (digit === 0 ? null : (digit as NanpureDigit)),
  );
}

function orderTechniques(
  techniques: readonly NanpureTechnique[] | undefined,
): readonly NanpureTechnique[] {
  if (!techniques) {
    return nanpureTechniques;
  }
  const allowed = new Set(techniques);
  return nanpureTechniques.filter((technique) => allowed.has(technique));
}

/**
 * 盤面を、局面ごとに最も浅い手筋から試して解き進める。推測（仮置きと後戻り）はしない。
 * 同じ盤面と手筋からは同じ経過になる。
 */
export function traceNanpureHumanSolve(
  initialBoard: NanpureBoard,
  options: NanpureHumanSolverOptions = {},
): NanpureHumanSolveResult {
  assertNanpureBoard(initialBoard);
  const techniques = orderTechniques(options.techniques);
  const rounds: NanpureHumanSolveRound[] = [];
  const state = createState(initialBoard);
  if (!state || hasContradiction(state)) {
    return { status: "contradiction", rounds, board: initialBoard };
  }

  for (;;) {
    const emptyCellCount = countEmptyCells(state);
    if (emptyCellCount === 0) {
      return { status: "solved", rounds, board: toBoard(state) };
    }

    let applied: { technique: NanpureTechnique; finding: Finding } | null =
      null;
    for (const technique of techniques) {
      const finding = findByTechnique(state, technique);
      if (!isEmptyFinding(finding)) {
        applied = { technique, finding };
        break;
      }
    }
    if (!applied) {
      return { status: "stalled", rounds, board: toBoard(state) };
    }

    const { technique, finding } = applied;
    const availablePlacementCount =
      finding.kind === "placements"
        ? countAvailablePlacements(state, techniques)
        : 0;
    if (finding.kind === "placements") {
      for (const { cellIndex, digit } of finding.placements) {
        if (!place(state, cellIndex, digit)) {
          return { status: "contradiction", rounds, board: toBoard(state) };
        }
      }
    } else {
      for (const { cellIndex, digit } of finding.eliminations) {
        state.candidates[cellIndex]! &= ~bitOf(digit);
      }
    }
    rounds.push({
      technique,
      placements: finding.kind === "placements" ? finding.placements : [],
      eliminations: finding.kind === "eliminations" ? finding.eliminations : [],
      availablePlacementCount,
      emptyCellCount,
    });
    if (hasContradiction(state)) {
      return { status: "contradiction", rounds, board: toBoard(state) };
    }
  }
}

export const _private = { createState, findByTechnique };
