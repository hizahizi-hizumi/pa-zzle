/**
 * 数の欄の、盤面の一辺ごとの列の数。数は問題が変わっても同じ位置に並べる。4×4 は盤面と同じ4列にすると2つ目の盤面に見えるので8列にし、
 * 5×5 と 6×6 は最後の行に枠が余り、そこに待ったとメモの切り替えが入る列の数にする。
 * 置き直しの数え方が、数の欄で隣り合う数を押し間違えた形を見分けるのに使うので、数の欄の描き方と数え方がここを共有する。
 */
const columnCountBySize: Readonly<Record<number, number>> = {
  4: 8,
  5: 7,
  6: 8,
};

export function getMagicSquareNumberPadColumnCount(size: number): number {
  return columnCountBySize[size] ?? size;
}

/** 数の欄で、2つの数の札が上下・左右・斜めに隣り合うか。 */
export function areMagicSquareNumberPadNeighbors(
  size: number,
  left: number,
  right: number,
): boolean {
  const columnCount = getMagicSquareNumberPadColumnCount(size);
  const rowDistance = Math.abs(
    Math.floor((left - 1) / columnCount) -
      Math.floor((right - 1) / columnCount),
  );
  const columnDistance = Math.abs(
    ((left - 1) % columnCount) - ((right - 1) % columnCount),
  );
  return left !== right && rowDistance <= 1 && columnDistance <= 1;
}
