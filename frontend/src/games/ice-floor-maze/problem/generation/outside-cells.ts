import {
  CELL_BRITTLE,
  CELL_OUTSIDE,
  CELL_ROCK,
  createElementRules,
  exploreStateSpace,
  findTouchedElements,
  findUsedCells,
  type GenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/** 生成した盤面と開始位置・ゴール。 */
export type GenerationProblem = {
  board: GenerationBoard;
  start: number;
  goal: number;
};

/** 盤面の外を決めるために、上限なしでたどる状態の数（探索の打ち切りで盤面の外を誤らないため）。 */
const UNBOUNDED_STATE_LIMIT = 10_000_000;

/**
 * 到達できるどの状態でも駒が通らない・止まらないマスを盤面の外にし、外周の盤面の外だけの行・列を切り落とす
 * （研究用の生成 v4 の `outside_marked`）。
 * 通るマスに接する岩・もろい岩は残す。どの状態でも崩れないもろい岩は岩にする。
 * 切り落とした盤面が横長なら、縦横を入れ替えて縦長にする（遊ぶ盤面は正方形か縦長だけ）。入れ替えは同じ問題の写しで、解は変わらない。
 */
export function markOutsideCells(
  problem: GenerationProblem,
): GenerationProblem {
  const { board, start, goal } = problem;
  const { width, height } = board;
  const rules = createElementRules(board);
  const space = exploreStateSpace(rules, start, {
    goal,
    limit: UNBOUNDED_STATE_LIMIT,
  })!;
  const used = findUsedCells(space);
  const touched = findTouchedElements(space);
  const cells = board.cells.map((code, cell) => {
    if (used[cell] === 1) {
      return code;
    }
    if (code !== CELL_ROCK && code !== CELL_BRITTLE) {
      return CELL_OUTSIDE;
    }
    const touchesUsedCell = rules.beyond.some((table) => {
      const neighbor = table[cell]!;
      return neighbor >= 0 && used[neighbor] === 1;
    });
    if (!touchesUsedCell) {
      return CELL_OUTSIDE;
    }
    const element = rules.elementOf[cell]!;
    return code === CELL_BRITTLE && ((touched >>> element) & 1) === 0
      ? CELL_ROCK
      : code;
  });

  const keptRows = Array.from({ length: height }, (_, y) => y).filter((y) =>
    cells
      .subarray(y * width, (y + 1) * width)
      .some((code) => code !== CELL_OUTSIDE),
  );
  const keptColumns = Array.from({ length: width }, (_, x) => x).filter((x) =>
    keptRows.some((y) => cells[y * width + x] !== CELL_OUTSIDE),
  );
  const top = keptRows[0]!;
  const left = keptColumns[0]!;
  const croppedWidth = keptColumns.at(-1)! - left + 1;
  const croppedHeight = keptRows.at(-1)! - top + 1;
  const transposes = croppedWidth > croppedHeight;
  const nextWidth = transposes ? croppedHeight : croppedWidth;
  function moveCell(cell: number): number {
    const x = (cell % width) - left;
    const y = Math.floor(cell / width) - top;
    return transposes ? x * nextWidth + y : y * nextWidth + x;
  }
  const nextCells = new Uint8Array(croppedWidth * croppedHeight);
  for (let y = top; y < top + croppedHeight; y += 1) {
    for (let x = left; x < left + croppedWidth; x += 1) {
      const cell = y * width + x;
      nextCells[moveCell(cell)] = cells[cell]!;
    }
  }
  return {
    board: {
      width: nextWidth,
      height: transposes ? croppedWidth : croppedHeight,
      cells: nextCells,
    },
    start: moveCell(start),
    goal: moveCell(goal),
  };
}
