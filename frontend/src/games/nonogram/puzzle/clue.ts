import { listNonogramLines } from "@/games/nonogram/puzzle/board";
import {
  getNonogramPatternLine,
  type NonogramPattern,
} from "@/games/nonogram/puzzle/pattern";

/** 1本の行・列の黒の塊の長さを、行なら左から、列なら上から順に並べたもの。黒の無い線は空の配列。 */
export type NonogramClue = readonly number[];

/** 行ヒントを上から、列ヒントを左から並べたもの。 */
export type NonogramClues = {
  rows: readonly NonogramClue[];
  columns: readonly NonogramClue[];
};

/** 線のマスを先頭から読み、続けて黒いマスの数を塊ごとに並べる。 */
export function computeNonogramLineClue(black: readonly boolean[]): number[] {
  const clue: number[] = [];
  let runLength = 0;
  for (const isBlack of black) {
    if (isBlack) {
      runLength += 1;
    } else if (runLength > 0) {
      clue.push(runLength);
      runLength = 0;
    }
  }
  if (runLength > 0) {
    clue.push(runLength);
  }
  return clue;
}

export function computeNonogramClues(pattern: NonogramPattern): NonogramClues {
  const rows: number[][] = [];
  const columns: number[][] = [];
  for (const line of listNonogramLines(pattern)) {
    const clue = computeNonogramLineClue(getNonogramPatternLine(pattern, line));
    (line.axis === "row" ? rows : columns).push(clue);
  }
  return { rows, columns };
}

export function areSameNonogramClue(
  left: NonogramClue,
  right: NonogramClue,
): boolean {
  return (
    left.length === right.length &&
    left.every((length, blockIndex) => length === right[blockIndex])
  );
}

export function areSameNonogramClues(
  left: NonogramClues,
  right: NonogramClues,
): boolean {
  function areSameLines(
    leftLines: readonly NonogramClue[],
    rightLines: readonly NonogramClue[],
  ): boolean {
    return (
      leftLines.length === rightLines.length &&
      leftLines.every((clue, lineIndex) =>
        areSameNonogramClue(clue, rightLines[lineIndex] ?? []),
      )
    );
  }
  return (
    areSameLines(left.rows, right.rows) &&
    areSameLines(left.columns, right.columns)
  );
}
