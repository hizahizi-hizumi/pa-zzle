import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";
import {
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";

/**
 * 試し置きで見える知らせ。
 * - `remain`: 今の合計を出し、違反（埋まって合わない列、空きがあるのに合計に届いた・超えた列）を知らせる（ゲームの表示）。
 * - `filled`: 埋まった列の合否だけを知らせる。
 * - `none`: 何も知らせない。全部埋めて魔方陣にならなければ、最後の試し置きから戻す。
 */
export type MagicSquareTrialDisplay = "remain" | "filled" | "none";

export type MagicSquareTrialSolveInput = {
  size: number;
  givens: MagicSquareGrid;
  random: ProblemRandom;
  display: MagicSquareTrialDisplay;
  /** 慣れた試し置き: 空きが2マスの列のマスには、相手のマスに入る数が残っている数だけを試す。 */
  pairAware: boolean;
  /** 置く回数の上限。 */
  moveLimit: number;
};

/**
 * - `solved`: 魔方陣にできた。
 * - `moveCount`: 置いた回数（試し置きと、空きが1マスの列を埋めた回数）。
 * - `trialCount`: 試し置きの回数。
 * - `undoCount`: 戻した回数。試し置きとそれに続いた空き1マスの列の埋めを、まとめて1回と数える。
 * - `stopReason`: 解けなかった理由。`bad-givens` は与える数だけで矛盾した、`move-limit` は置く回数の上限に届いた、
 *   `exhausted` は試す数が尽きた。
 */
export type MagicSquareTrialSolveTrace = {
  solved: boolean;
  moveCount: number;
  trialCount: number;
  undoCount: number;
  stopReason: "bad-givens" | "move-limit" | "exhausted" | null;
};

type TrialFrame = {
  cell: number;
  values: number[];
  next: number;
  placed: number[];
};

/**
 * 推理をしない素朴な解き方。空きが1マスの列はその数を入れ（引き算は読みに数えない）、入れた数が使用済みか範囲外ならその場で
 * 矛盾に気づく。ほかは、空きの最も少ない列（2マス以上）のマスを無作為に選び、残っている数を無作為な順に試す。違反が出たら戻し、
 * 試す数が尽きたら1つ前の試し置きまで戻す。難易度の分類には使わず、上のレベルが試し置きで押し切られないかを測るのに使う。
 */
export function traceMagicSquareTrialSolve({
  size,
  givens,
  random,
  display,
  pairAware,
  moveLimit,
}: MagicSquareTrialSolveInput): MagicSquareTrialSolveTrace {
  const maxValue = getMagicSquareMaxValue(size);
  const magicSum = getMagicSquareMagicSum(size);
  const lines = listMagicSquareLines(size).map((line) =>
    getMagicSquareLineCellIndices(size, line),
  );
  const linesOfCell = Array.from({ length: maxValue }, (_, cell) =>
    lines.filter((cells) => cells.includes(cell)),
  );
  const grid = [...givens];
  const used = new Set(grid.filter(Boolean));
  let moveCount = 0;
  let trialCount = 0;
  let undoCount = 0;

  const lineSum = (cells: readonly number[]) =>
    cells.reduce((sum, cell) => sum + grid[cell]!, 0);
  const emptyCount = (cells: readonly number[]) =>
    cells.filter((cell) => !grid[cell]).length;

  const showsViolation = (cell: number): boolean => {
    if (display === "none") {
      return false;
    }
    return linesOfCell[cell]!.some((cells) => {
      const sum = lineSum(cells);
      return emptyCount(cells) === 0
        ? sum !== magicSum
        : display === "remain" && sum >= magicSum;
    });
  };

  const place = (cell: number, value: number) => {
    grid[cell] = value;
    used.add(value);
    moveCount += 1;
  };

  /** 空きが1マスの列を埋め続ける。矛盾したら `ok` が偽。 */
  const fillForced = (): { placed: number[]; ok: boolean } => {
    const placed: number[] = [];
    for (;;) {
      const line = lines.find((cells) => emptyCount(cells) === 1);
      if (!line) {
        return { placed, ok: true };
      }
      const cell = line.find((candidate) => !grid[candidate])!;
      const value = magicSum - lineSum(line);
      if (value < 1 || value > maxValue || used.has(value)) {
        return { placed, ok: false };
      }
      place(cell, value);
      placed.push(cell);
      if (showsViolation(cell)) {
        return { placed, ok: false };
      }
    }
  };

  const undo = (cells: readonly number[]) => {
    for (const cell of cells) {
      used.delete(grid[cell]!);
      grid[cell] = 0;
    }
  };

  const remainingValues = () =>
    Array.from({ length: maxValue }, (_, index) => index + 1).filter(
      (value) => !used.has(value),
    );

  /** 慣れた試し置きで、`cell` に `value` を試してよいか。 */
  const fitsPairs = (cell: number, value: number) =>
    linesOfCell[cell]!.every((cells) => {
      const sum = lineSum(cells);
      if (emptyCount(cells) === 2) {
        const partner = magicSum - sum - value;
        return (
          partner !== value &&
          partner >= 1 &&
          partner <= maxValue &&
          !used.has(partner)
        );
      }
      return sum + value < magicSum;
    });

  const chooseFrame = (): TrialFrame => {
    let fewest = Number.POSITIVE_INFINITY;
    let candidates: number[][] = [];
    for (const cells of lines) {
      const count = emptyCount(cells);
      if (count < 2) {
        continue;
      }
      if (count < fewest) {
        fewest = count;
        candidates = [cells];
      } else if (count === fewest) {
        candidates.push(cells);
      }
    }
    const line = pickProblemValue(candidates, random);
    const cell = pickProblemValue(
      line.filter((candidate) => !grid[candidate]),
      random,
    );
    const values = remainingValues().filter(
      (value) => !pairAware || fitsPairs(cell, value),
    );
    return {
      cell,
      values: shuffleProblemValues(values, random),
      next: 0,
      placed: [],
    };
  };

  const isFilled = () => grid.every(Boolean);
  const isMagic = () => lines.every((cells) => lineSum(cells) === magicSum);
  const trace = (
    solved: boolean,
    stopReason: MagicSquareTrialSolveTrace["stopReason"],
  ): MagicSquareTrialSolveTrace => ({
    solved,
    moveCount,
    trialCount,
    undoCount,
    stopReason,
  });

  if (!fillForced().ok) {
    return trace(false, "bad-givens");
  }
  const stack: TrialFrame[] = [];
  for (;;) {
    if (isFilled() && (display !== "none" || isMagic())) {
      return trace(true, null);
    }
    const frame = isFilled() ? null : chooseFrame();
    if (moveCount > moveLimit) {
      return trace(false, "move-limit");
    }
    if (frame) {
      stack.push(frame);
    }
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      if (top.placed.length > 0) {
        undo(top.placed);
        top.placed = [];
        undoCount += 1;
      }
      if (top.next >= top.values.length) {
        stack.pop();
        continue;
      }
      const value = top.values[top.next]!;
      top.next += 1;
      place(top.cell, value);
      trialCount += 1;
      top.placed = [top.cell];
      if (showsViolation(top.cell)) {
        continue;
      }
      const forced = fillForced();
      top.placed.push(...forced.placed);
      if (forced.ok) {
        break;
      }
    }
    if (stack.length === 0) {
      return trace(false, "exhausted");
    }
  }
}
