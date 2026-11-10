import type { BridgesBoard } from "@/games/bridges/puzzle/board";

/** 島の位置と数字を `row,column,clue` で並べた文字列。 */
function describeIslands(
  islands: readonly { row: number; column: number; clue: number }[],
): string {
  return [...islands]
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .map(({ row, column, clue }) => `${row},${column},${clue}`)
    .join(";");
}

/**
 * 回転・反転（8通り）で同じ形になる盤面に同じ値を返す、正規化キー。問題集から同型の重複を除くのに使う。
 * 8通りの盤面の記述のうち、辞書順で最小のものに盤面の大きさを添える。
 */
export function getBridgesSymmetryKey(board: BridgesBoard): string {
  const { width, height, islands } = board;
  const variants: string[] = [];
  for (const transposed of [false, true]) {
    for (const flipsRows of [false, true]) {
      for (const flipsColumns of [false, true]) {
        const rows = transposed ? width : height;
        const columns = transposed ? height : width;
        variants.push(
          `${rows}x${columns}:${describeIslands(
            islands.map(({ row, column, clue }) => {
              const baseRow = transposed ? column : row;
              const baseColumn = transposed ? row : column;
              return {
                row: flipsRows ? rows - 1 - baseRow : baseRow,
                column: flipsColumns ? columns - 1 - baseColumn : baseColumn,
                clue,
              };
            }),
          )}`,
        );
      }
    }
  }
  return variants.reduce((smallest, variant) =>
    variant < smallest ? variant : smallest,
  );
}

/**
 * 島の位置だけの正規化キー。数字を見ずに回転・反転（8通り）で同じ配置になる盤面に同じ値を返す。
 * 配置が同じで数字だけが違う問題は、盤面を見た印象も解き始めの手がかりもほぼ同じなので、問題集から除くのに使う。
 */
export function getBridgesLayoutKey(board: BridgesBoard): string {
  return getBridgesSymmetryKey({
    ...board,
    islands: board.islands.map((island) => ({ ...island, clue: 0 })),
  });
}
