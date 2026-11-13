import type {
  HakoiriMusumeBoardSize,
  HakoiriMusumeCellPosition,
  HakoiriMusumePieceShape,
} from "@/games/hakoiri-musume/puzzle/board";

/** 箱の縁の太さ（マス幅に対する割合）。四辺とも同じ太さで、出口の所だけ切り欠く。 */
export const BOX_RIM_CELLS = 0.2;

/** 隣り合う駒の間にあける隙間の半分（マス幅に対する割合）。駒どうしの境目を見せる。 */
export const PIECE_GAP_CELLS = 0.035;

/** 箱の外形の幅と高さ（マス幅を 1 とする）。 */
export function getBoxExtent({ columns, rows }: HakoiriMusumeBoardSize): {
  width: number;
  height: number;
} {
  return {
    width: columns + BOX_RIM_CELLS * 2,
    height: rows + BOX_RIM_CELLS * 2,
  };
}

/** % で持つ。 */
export type BoxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 箱の中の、左上 `position` から `columns` 列 × `rows` 行を占める所の、箱の外形に対する位置と大きさ。 */
export function getBoxRect(
  size: HakoiriMusumeBoardSize,
  { row, column }: HakoiriMusumeCellPosition,
  { columns, rows }: Pick<HakoiriMusumePieceShape, "columns" | "rows">,
  inset = 0,
): BoxRect {
  const extent = getBoxExtent(size);
  return {
    left: ((BOX_RIM_CELLS + column + inset) / extent.width) * 100,
    top: ((BOX_RIM_CELLS + row + inset) / extent.height) * 100,
    width: ((columns - inset * 2) / extent.width) * 100,
    height: ((rows - inset * 2) / extent.height) * 100,
  };
}

function isRectangular(shape: HakoiriMusumePieceShape): boolean {
  return shape.cells.length === shape.columns * shape.rows;
}

/**
 * 駒の見た目の位置と大きさ。長方形の駒は占めるマスから隙間の分だけ内側。長方形でない駒（L字）は外接矩形いっぱいにし、
 * 隙間は `getPieceOutline` の輪郭で空ける。
 */
export function getPieceRect(
  size: HakoiriMusumeBoardSize,
  position: HakoiriMusumeCellPosition,
  shape: HakoiriMusumePieceShape,
): BoxRect {
  return getBoxRect(
    size,
    position,
    shape,
    isRectangular(shape) ? PIECE_GAP_CELLS : 0,
  );
}

type OutlinePoint = { x: number; y: number };

/**
 * 長方形でない駒の輪郭（CSS の `clip-path` の値）。駒の占めるマスの外周を隙間の分だけ内側へずらした多角形で、頂点は外接矩形に
 * 対する割合（%）。長方形の駒は角を丸めた面で見せるので `null`。
 */
export function getPieceOutline(shape: HakoiriMusumePieceShape): string | null {
  if (isRectangular(shape)) {
    return null;
  }
  // マスごとの4辺を時計回りの向きで集め、隣のマスと共有する辺（逆向きの辺が別のマスにある）を除くと外周が残る。
  const key = (point: OutlinePoint) => `${point.x},${point.y}`;
  const edges = new Map<string, { from: OutlinePoint; to: OutlinePoint }>();
  for (const { row, column } of shape.cells) {
    const corners = [
      { x: column, y: row },
      { x: column + 1, y: row },
      { x: column + 1, y: row + 1 },
      { x: column, y: row + 1 },
    ];
    corners.forEach((from, index) => {
      const to = corners[(index + 1) % corners.length]!;
      const reverse = `${key(to)}>${key(from)}`;
      if (edges.has(reverse)) {
        edges.delete(reverse);
      } else {
        edges.set(`${key(from)}>${key(to)}`, { from, to });
      }
    });
  }
  const nextByStart = new Map(
    [...edges.values()].map(({ from, to }) => [key(from), to]),
  );
  const start = [...edges.values()][0]!.from;
  const loop: OutlinePoint[] = [start];
  for (
    let point = nextByStart.get(key(start))!;
    key(point) !== key(start);
    point = nextByStart.get(key(point))!
  ) {
    loop.push(point);
  }
  // 向きの変わる所だけを頂点に残し、頂点の前後の辺の内側（時計回りに進む向きの右手）へ、それぞれ隙間の分だけずらす。
  const vertices = loop.flatMap((point, index) => {
    const previous = loop[(index - 1 + loop.length) % loop.length]!;
    const next = loop[(index + 1) % loop.length]!;
    const incoming = { x: point.x - previous.x, y: point.y - previous.y };
    const outgoing = { x: next.x - point.x, y: next.y - point.y };
    if (incoming.x === outgoing.x && incoming.y === outgoing.y) {
      return [];
    }
    return [
      {
        x: point.x - PIECE_GAP_CELLS * (incoming.y + outgoing.y),
        y: point.y + PIECE_GAP_CELLS * (incoming.x + outgoing.x),
      },
    ];
  });
  const points = vertices.map(
    ({ x, y }) => `${(x / shape.columns) * 100}% ${(y / shape.rows) * 100}%`,
  );
  return `polygon(${points.join(", ")})`;
}

/** 箱の外形の上の点（外形の左上を原点に、幅・高さを 1 とした割合）を、箱の中のマス幅を 1 とした座標にする。 */
export function toBoxCellPoint(
  size: HakoiriMusumeBoardSize,
  xRatio: number,
  yRatio: number,
): { row: number; column: number } {
  const extent = getBoxExtent(size);
  return {
    row: yRatio * extent.height - BOX_RIM_CELLS,
    column: xRatio * extent.width - BOX_RIM_CELLS,
  };
}

export function toBoxStyle({ left, top, width, height }: BoxRect) {
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}
