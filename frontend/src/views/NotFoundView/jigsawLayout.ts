import {
  createJigsawCellPath,
  createJigsawOutlinePath,
  type JigsawSeam,
  jigsawSeamHalfWidth,
  reverseJigsawSeam,
} from "@/views/NotFoundView/jigsawGeometry";

export type BoardPoint = {
  x: number;
  y: number;
};

export type ZeroPieceId = "upper" | "lower";

/** 404の0から外れた1枚のピース。`slot` は盤面の穴、`start` は外れて置かれている位置の左上。 */
export type ZeroPiece = {
  id: ZeroPieceId;
  path: string;
  slot: BoardPoint;
  start: BoardPoint;
};

export type Digit404Glyphs = {
  baselineY: number;
  fontSize: number;
  glyphXs: readonly [number, number, number];
};

/** 横に連続したセルを結合した1枚のリンク用ピース。`x` / `y` / `width` / `height` はセル部分の範囲。 */
export type LinkPiece = {
  height: number;
  path: string;
  width: number;
  x: number;
  y: number;
};

export type NotFoundJigsawLayout = {
  boardOutlinePath: string;
  digits: Digit404Glyphs;
  headingCenterY: number;
  height: number;
  linkPiece: LinkPiece;
  /** 見出しとリンクのラベルを等倍から拡大する比率。 */
  textScale: number;
  pieceSize: number;
  snapRadius: number;
  /** ピースの頭がセルの外へ出る最大の長さ。 */
  tabExtent: number;
  width: number;
  zeroPieces: readonly [ZeroPiece, ZeroPiece];
};

export type AvailableArea = {
  height: number;
  width: number;
};

type Cell = {
  column: number;
  row: number;
};

type Bounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type Grid = {
  columns: number;
  link: {
    cellCount: number;
    firstColumn: number;
    /** 凹みを入れてはならない、ラベルの字面に余白を足した範囲。 */
    labelKeepOut: Bounds;
    row: number;
  };
  originX: number;
  originY: number;
  pieceSize: number;
  rows: number;
};

type SeamDirection = JigsawSeam["direction"];

/**
 * 盤面のすべての内側の辺の凸凹。`horizontal[row][column]` はセルとその右のセル、
 * `vertical[row][column]` はセルとその下のセルの間の辺で、向きは左または上のセルから見る。
 */
type BoardSeams = {
  horizontal: readonly (readonly JigsawSeam[])[];
  vertical: readonly (readonly JigsawSeam[])[];
};

type SeamAxis = keyof BoardSeams;

/** ピースの1辺。`sign` は辺の向きをこのピースから見た向きへ変換する符号。 */
type PieceSide = {
  axis: SeamAxis;
  column: number;
  row: number;
  sign: SeamDirection;
};

/** 1枚のピース。`lastCell` は行優先で辿ったときにピースの中で最後に来るセル。 */
type Piece = {
  lastCell: Cell;
  sides: readonly PieceSide[];
};

type BoardArrangement = {
  grid: Grid;
  headingCenterY: number;
  height: number;
  looseTop: number;
  textScale: number;
  zeroCenterY: number;
};

type Range = {
  max: number;
  min: number;
};

const seamCenterRange = { min: 0.44, max: 0.56 } as const satisfies Range;
const seamDepthRange = { min: 0.24, max: 0.28 } as const satisfies Range;
const maxSeamDepth = seamDepthRange.max;

const pieceSizeRange = { min: 44, max: 96 } as const;
const pieceSizePerWidth = 0.134;
// 縦に並ぶ要素がこのピース数ぶんの高さに収まるとき、スクロールせずに表示できる。
const stackHeightInPieces = 7.1;

// 0 の字面の高さがセル2つ分になる文字サイズ。0 の中心をセルの頂点に合わせると、斜めの2セルが0を4分の1ずつ覆う。
const digitFontSizePerPiece = 2.74;
// 0 を縦の2セルで覆うときは、0 の字面の幅がセルの幅に収まる文字サイズにする。
const verticalPairInkInset = 8;
// Zen Kaku Gothic New Bold の数字の字面比率。
const digitInkWidth = 0.41;
const digitInkCenterFromOrigin = 0.245;
const digitInkCenterFromBaseline = 0.345;
const digitAdvance = 0.6;

// 文字を等倍で描くピースの大きさ。これより大きいピースでは、盤面に釣り合うよう文字も同じ比率で大きくする。
const textScaleBasePieceSize = 72;
// 等倍の text-screen-title の行の高さ。
const headingBandHeight = 32;
// 「パズル一覧へ戻る」を等倍の text-body・semibold で描いたときの字面の大きさ。
const linkLabelInk = { width: 128, height: 18 } as const;
const linkLabelSidePadding = 24;
// 凹みと字面の間に最低限空ける距離。
const linkLabelClearance = 3;

const minimumGapInPieces = 0.08;
const topMarginInPieces = 0.3;
const bottomMarginInPieces = 0.45;
const looseGapInPieces = 0.9;
const snapRadiusInPieces = 0.55;

/** 凸凹の配置を決める乱数のシードを作る。ページを開くたびに盤面の模様を変えるために使う。 */
export function createJigsawSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** 同じ領域とシードからは常に同じレイアウトを返す。 */
export function createNotFoundJigsawLayout(
  area: AvailableArea,
  seed: number,
): NotFoundJigsawLayout {
  const { grid, headingCenterY, height, looseTop, textScale, zeroCenterY } =
    arrangeBoard(area);
  const { pieceSize } = grid;
  const { width } = area;
  const centerX = width / 2;
  const seams = createBoardSeams(grid, seed);

  const zeroCells = findZeroCells(grid, centerX, zeroCenterY);
  const zeroCellKeys = new Set(zeroCells.map(cellKey));
  const boardPiecePaths: string[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      if (
        isLinkCell(grid, { row, column }) ||
        zeroCellKeys.has(cellKey({ row, column }))
      ) {
        continue;
      }
      boardPiecePaths.push(createCellPath(grid, seams, { row, column }));
    }
  }

  const fontSize = isDiagonalZeroPair(grid)
    ? pieceSize * digitFontSizePerPiece
    : Math.min(
        pieceSize * digitFontSizePerPiece,
        (pieceSize - verticalPairInkInset) / digitInkWidth,
      );
  const zeroOriginX = centerX - fontSize * digitInkCenterFromOrigin;
  const glyphStep = fontSize * digitAdvance;
  const looseStarts = [
    centerX - (pieceSize * looseGapInPieces) / 2 - pieceSize,
    centerX + (pieceSize * looseGapInPieces) / 2,
  ] as const;
  const [upperCell, lowerCell] = zeroCells;

  return {
    boardOutlinePath: boardPiecePaths.join(" "),
    digits: {
      baselineY: zeroCenterY + fontSize * digitInkCenterFromBaseline,
      fontSize,
      glyphXs: [zeroOriginX - glyphStep, zeroOriginX, zeroOriginX + glyphStep],
    },
    headingCenterY,
    height,
    linkPiece: {
      height: pieceSize,
      path: createLinkPath(grid, seams),
      width: pieceSize * grid.link.cellCount,
      x: grid.originX + grid.link.firstColumn * pieceSize,
      y: grid.originY + grid.link.row * pieceSize,
    },
    pieceSize,
    snapRadius: pieceSize * snapRadiusInPieces,
    textScale,
    tabExtent: pieceSize * maxSeamDepth,
    width,
    zeroPieces: [
      createZeroPiece(grid, seams, "upper", upperCell, {
        x: looseStarts[0],
        y: looseTop,
      }),
      createZeroPiece(grid, seams, "lower", lowerCell, {
        x: looseStarts[1],
        y: looseTop,
      }),
    ],
  };
}

/** 0 の中心から下へ、外れピース・見出し・リンクピースを縦に並べ、リンクに揃えた格子を決める。 */
function arrangeBoard({
  width,
  height: availableHeight,
}: AvailableArea): BoardArrangement {
  const pieceSize = Math.floor(
    clamp(
      Math.min(
        width * pieceSizePerWidth,
        availableHeight / stackHeightInPieces,
      ),
      pieceSizeRange.min,
      pieceSizeRange.max,
    ),
  );
  const tabExtent = pieceSize * maxSeamDepth;
  const textScale = Math.max(1, pieceSize / textScaleBasePieceSize);
  const scaledHeadingBandHeight = headingBandHeight * textScale;
  const labelInk = {
    width: linkLabelInk.width * textScale,
    height: linkLabelInk.height * textScale,
  };
  const linkCellCount = Math.ceil(
    (labelInk.width + linkLabelSidePadding * textScale * 2) / pieceSize,
  );
  const centerX = width / 2;

  // 見出しは盤面に印刷した文字として継ぎ目線の下に描くため、横の継ぎ目が字面を貫かないよう、リンクのすぐ上の行の中央に置く。
  // 外れピースは 0 と見出しの間の中央に置き、上下とも頭の出っ張り分の間隔を空ける。
  const minimumGap = pieceSize * minimumGapInPieces;
  const headingClearanceAboveLink = pieceSize / 2 + scaledHeadingBandHeight / 2;
  const minimumZeroToLinkDistance =
    pieceSize +
    (minimumGap + tabExtent) +
    pieceSize +
    (tabExtent + minimumGap) +
    headingClearanceAboveLink;
  const tightRowsToLink = Math.ceil(minimumZeroToLinkDistance / pieceSize);
  const topMargin = pieceSize * topMarginInPieces;
  const bottomMargin = pieceSize * bottomMarginInPieces;
  function stackHeight(rowsToLink: number) {
    return topMargin + pieceSize * (rowsToLink + 2) + tabExtent + bottomMargin;
  }
  // 高さに余裕があれば1行ぶん間隔を広げる。
  const rowsToLink =
    stackHeight(tightRowsToLink + 1) <= availableHeight
      ? tightRowsToLink + 1
      : tightRowsToLink;
  const height = Math.max(availableHeight, stackHeight(rowsToLink));
  const zeroCenterY =
    topMargin + pieceSize + (height - stackHeight(rowsToLink)) / 2;
  const linkTop = zeroCenterY + pieceSize * rowsToLink;
  const headingCenterY = linkTop - pieceSize / 2;
  const zeroBottom = zeroCenterY + pieceSize;
  const headingTop = headingCenterY - scaledHeadingBandHeight / 2;
  const looseTop = (zeroBottom + headingTop) / 2 - pieceSize / 2;

  const linkLeft = centerX - (linkCellCount * pieceSize) / 2;
  const originX = alignedOrigin(linkLeft, pieceSize);
  const originY = alignedOrigin(linkTop, pieceSize);
  const linkRow = Math.round((linkTop - originY) / pieceSize);
  const linkFirstColumn = Math.round((linkLeft - originX) / pieceSize);
  const linkCenter = {
    x: originX + (linkFirstColumn + linkCellCount / 2) * pieceSize,
    y: originY + (linkRow + 0.5) * pieceSize,
  };

  return {
    grid: {
      columns: Math.ceil((width - originX) / pieceSize + 0.25),
      link: {
        cellCount: linkCellCount,
        firstColumn: linkFirstColumn,
        labelKeepOut: {
          bottom: linkCenter.y + labelInk.height / 2 + linkLabelClearance,
          left: linkCenter.x - labelInk.width / 2 - linkLabelClearance,
          right: linkCenter.x + labelInk.width / 2 + linkLabelClearance,
          top: linkCenter.y - labelInk.height / 2 - linkLabelClearance,
        },
        row: linkRow,
      },
      originX,
      originY,
      pieceSize,
      rows: Math.ceil((height - originY) / pieceSize + 0.25),
    },
    headingCenterY,
    height,
    looseTop,
    textScale,
    zeroCenterY,
  };
}

/** 盤面の外周の平らな辺が画面外へ出るよう、基準線から1/4ピース以上左上へずらした格子の原点を返す。 */
function alignedOrigin(anchor: number, pieceSize: number): number {
  return anchor - Math.ceil(anchor / pieceSize + 0.25) * pieceSize;
}

/**
 * 0 の中心は常に横の格子線上にある。リンクのセル数が偶数なら縦の格子線上にもあるので斜めに2セル、
 * 奇数ならセルの中央にあるので縦に2セルを選ぶ。
 */
function findZeroCells(
  grid: Grid,
  zeroCenterX: number,
  zeroCenterY: number,
): readonly [Cell, Cell] {
  const lowerRow = Math.round((zeroCenterY - grid.originY) / grid.pieceSize);
  const upperRow = lowerRow - 1;

  if (isDiagonalZeroPair(grid)) {
    const rightColumn = Math.round(
      (zeroCenterX - grid.originX) / grid.pieceSize,
    );
    return [
      { row: upperRow, column: rightColumn - 1 },
      { row: lowerRow, column: rightColumn },
    ];
  }

  const column = Math.floor((zeroCenterX - grid.originX) / grid.pieceSize);
  return [
    { row: upperRow, column },
    { row: lowerRow, column },
  ];
}

function isDiagonalZeroPair(grid: Grid): boolean {
  return grid.link.cellCount % 2 === 0;
}

function createZeroPiece(
  grid: Grid,
  seams: BoardSeams,
  id: ZeroPieceId,
  cell: Cell,
  start: BoardPoint,
): ZeroPiece {
  return {
    id,
    path: createCellPath(grid, seams, cell),
    slot: cellOrigin(grid, cell),
    start,
  };
}

function createCellPath(
  grid: Grid,
  seams: BoardSeams,
  { row, column }: Cell,
): string {
  const origin = cellOrigin(grid, { row, column });

  return createJigsawCellPath(origin.x, origin.y, grid.pieceSize, {
    top:
      row === 0
        ? null
        : reverseJigsawSeam(seamAt(seams, "vertical", row - 1, column)),
    right:
      column === grid.columns - 1
        ? null
        : seamAt(seams, "horizontal", row, column),
    bottom:
      row === grid.rows - 1 ? null : seamAt(seams, "vertical", row, column),
    left:
      column === 0
        ? null
        : reverseJigsawSeam(seamAt(seams, "horizontal", row, column - 1)),
  });
}

function createLinkPath(grid: Grid, seams: BoardSeams): string {
  const { cellCount, firstColumn, row } = grid.link;
  const origin = cellOrigin(grid, { row, column: firstColumn });
  const columns = Array.from(
    { length: cellCount },
    (_, index) => firstColumn + index,
  );

  return createJigsawOutlinePath(
    origin.x,
    origin.y,
    grid.pieceSize,
    cellCount,
    {
      top: columns.map((column) =>
        reverseJigsawSeam(seamAt(seams, "vertical", row - 1, column)),
      ),
      right: seamAt(seams, "horizontal", row, firstColumn + cellCount - 1),
      bottom: columns.map((column) => seamAt(seams, "vertical", row, column)),
      left: reverseJigsawSeam(
        seamAt(seams, "horizontal", row, firstColumn - 1),
      ),
    },
  );
}

function cellOrigin(grid: Grid, { row, column }: Cell): BoardPoint {
  return {
    x: grid.originX + column * grid.pieceSize,
    y: grid.originY + row * grid.pieceSize,
  };
}

/**
 * 盤面の辺ごとに凸凹の向き・位置・深さを乱数で決める。そのうえで、どのピースも内側の辺が
 * すべて同じ向きにならないよう向きを揃え直し、リンクのラベルに掛かる凹みを浅くする。
 */
function createBoardSeams(grid: Grid, seed: number): BoardSeams {
  const random = createSeededRandom(seed);
  function randomSeam(): JigsawSeam {
    return {
      center: pickInRange(seamCenterRange, random()),
      depth: pickInRange(seamDepthRange, random()),
      direction: random() < 0.5 ? 1 : -1,
    };
  }
  const seams = {
    horizontal: Array.from({ length: grid.rows }, () =>
      Array.from({ length: grid.columns - 1 }, randomSeam),
    ),
    vertical: Array.from({ length: grid.rows - 1 }, () =>
      Array.from({ length: grid.columns }, randomSeam),
    ),
  };
  mixDirectionsWithinPieces(grid, seams, random);

  return {
    horizontal: seams.horizontal.map((rowSeams, row) =>
      rowSeams.map((seam, column) =>
        keepClearOfLinkLabel(grid, seam, { row, column }, "right"),
      ),
    ),
    vertical: seams.vertical.map((rowSeams, row) =>
      rowSeams.map((seam, column) =>
        keepClearOfLinkLabel(grid, seam, { row, column }, "bottom"),
      ),
    ),
  };
}

/**
 * ピースを行優先で確定させ、辺がすべて同じ向きのピースはまだ確定していない隣接ピースとの辺を反転する。
 * 右辺と下辺はまだ確定していないピースとの辺なので、反転しても確定済みのピースを崩さない。
 * 右辺も下辺も持たない最後の角のピースだけは、隣接ピースを崩さない辺があるときに限り反転する。
 */
function mixDirectionsWithinPieces(
  grid: Grid,
  seams: Record<SeamAxis, JigsawSeam[][]>,
  random: () => number,
) {
  const pieces = listPiecesInBoardOrder(grid);
  const pieceByCell = new Map(
    pieces.flatMap((piece) =>
      pieceCells(grid, piece).map((cell) => [cellKey(cell), piece] as const),
    ),
  );

  function flip(side: PieceSide) {
    const rowSeams = seams[side.axis][side.row];
    const seam = rowSeams?.[side.column];
    if (rowSeams && seam) {
      rowSeams[side.column] = {
        ...seam,
        direction: seam.direction === 1 ? -1 : 1,
      };
    }
  }

  for (const piece of pieces) {
    if (!isOneWay(seams, piece.sides)) {
      continue;
    }
    const { lastCell } = piece;
    const undecidedSides = piece.sides.filter(
      (side) =>
        side.sign === 1 &&
        side.row === lastCell.row &&
        side.column === lastCell.column,
    );
    const flippableSides =
      undecidedSides.length > 0
        ? undecidedSides
        : piece.sides.filter((side) => {
            const neighbor = pieceByCell.get(cellKey(cellAcross(side)));
            if (!neighbor) {
              return false;
            }
            flip(side);
            const keepsNeighborMixed = !isOneWay(seams, neighbor.sides);
            flip(side);
            return keepsNeighborMixed;
          });
    const side = flippableSides[Math.floor(random() * flippableSides.length)];
    if (side) {
      flip(side);
    }
  }
}

/** 盤面のピースを、各ピースの最後のセルの行優先順に並べる。 */
function listPiecesInBoardOrder(grid: Grid): Piece[] {
  const pieces: Piece[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const cell = { row, column };
      if (!isLinkCell(grid, cell)) {
        pieces.push({ lastCell: cell, sides: cellSides(grid, cell) });
        continue;
      }
      const { cellCount, firstColumn } = grid.link;
      if (column === firstColumn + cellCount - 1) {
        pieces.push({ lastCell: cell, sides: linkSides(grid) });
      }
    }
  }
  return pieces;
}

function cellSides(grid: Grid, { row, column }: Cell): PieceSide[] {
  const sides: PieceSide[] = [];
  if (row > 0) {
    sides.push({ axis: "vertical", row: row - 1, column, sign: -1 });
  }
  if (column < grid.columns - 1) {
    sides.push({ axis: "horizontal", row, column, sign: 1 });
  }
  if (row < grid.rows - 1) {
    sides.push({ axis: "vertical", row, column, sign: 1 });
  }
  if (column > 0) {
    sides.push({ axis: "horizontal", row, column: column - 1, sign: -1 });
  }
  return sides;
}

function linkSides(grid: Grid): PieceSide[] {
  const { cellCount, firstColumn, row } = grid.link;
  const lastColumn = firstColumn + cellCount - 1;
  const columns = Array.from(
    { length: cellCount },
    (_, index) => firstColumn + index,
  );
  return [
    ...columns.map(
      (column): PieceSide => ({
        axis: "vertical",
        row: row - 1,
        column,
        sign: -1,
      }),
    ),
    { axis: "horizontal", row, column: lastColumn, sign: 1 },
    ...columns.map(
      (column): PieceSide => ({ axis: "vertical", row, column, sign: 1 }),
    ),
    { axis: "horizontal", row, column: firstColumn - 1, sign: -1 },
  ];
}

function pieceCells(grid: Grid, piece: Piece): Cell[] {
  if (!isLinkCell(grid, piece.lastCell)) {
    return [piece.lastCell];
  }
  const { cellCount, firstColumn, row } = grid.link;
  return Array.from({ length: cellCount }, (_, index) => ({
    row,
    column: firstColumn + index,
  }));
}

/** 辺を挟んで、その辺を持つピースの反対側にあるセル。 */
function cellAcross({ axis, row, column, sign }: PieceSide): Cell {
  const isOwnedByUpperLeft = sign === 1;
  if (axis === "horizontal") {
    return { row, column: isOwnedByUpperLeft ? column + 1 : column };
  }
  return { row: isOwnedByUpperLeft ? row + 1 : row, column };
}

/** 平らでない辺が2辺以上あり、そのすべてがピースから見て同じ向きか。 */
function isOneWay(seams: BoardSeams, sides: readonly PieceSide[]): boolean {
  if (sides.length < 2) {
    return false;
  }
  const directions = new Set(sides.map((side) => sideDirection(seams, side)));
  return directions.size === 1;
}

function sideDirection(seams: BoardSeams, side: PieceSide): SeamDirection {
  return seamAt(seams, side.axis, side.row, side.column).direction === side.sign
    ? 1
    : -1;
}

function seamAt(
  seams: BoardSeams,
  axis: SeamAxis,
  row: number,
  column: number,
): JigsawSeam {
  const seam = seams[axis][row]?.[column];
  if (!seam) {
    throw new Error(`盤面に ${axis} (${row}, ${column}) の辺がありません`);
  }
  return seam;
}

function isLinkCell(grid: Grid, { row, column }: Cell): boolean {
  const { cellCount, firstColumn, row: linkRow } = grid.link;
  return (
    row === linkRow && column >= firstColumn && column < firstColumn + cellCount
  );
}

/**
 * リンクの外周で、リンクへ食い込む凹みがラベルの字面へ掛かる場合だけ、字面の手前で止まる深さまで浅くする。
 * 隣接ピースも同じ辺をこの結果から描くため、噛み合わせは保たれる。
 */
function keepClearOfLinkLabel(
  grid: Grid,
  seam: JigsawSeam,
  owner: Cell,
  side: "right" | "bottom",
): JigsawSeam {
  const neighbor =
    side === "right"
      ? { row: owner.row, column: owner.column + 1 }
      : { row: owner.row + 1, column: owner.column };
  const isOwnerLink = isLinkCell(grid, owner);
  const isNeighborLink = isLinkCell(grid, neighbor);
  const headsIntoLink = isNeighborLink
    ? !isOwnerLink && seam.direction === 1
    : isOwnerLink && seam.direction === -1;
  if (!headsIntoLink) {
    return seam;
  }

  const { pieceSize } = grid;
  const keepOut = grid.link.labelKeepOut;
  const edgeOrigin = cellOrigin(grid, owner);

  if (side === "right") {
    const edgeX = edgeOrigin.x + pieceSize;
    const room = isNeighborLink ? keepOut.left - edgeX : edgeX - keepOut.right;
    return limitDepth(seam, room / pieceSize);
  }

  // 下辺は右から左へ辿るため、辺に沿った位置は右端から測る。
  const headCenterX = edgeOrigin.x + (1 - seam.center) * pieceSize;
  const headHalfWidth = jigsawSeamHalfWidth(seam) * pieceSize;
  const overlapsLabel =
    headCenterX + headHalfWidth > keepOut.left &&
    headCenterX - headHalfWidth < keepOut.right;
  if (!overlapsLabel) {
    return seam;
  }

  const edgeY = edgeOrigin.y + pieceSize;
  const room = isNeighborLink ? keepOut.top - edgeY : edgeY - keepOut.bottom;
  return limitDepth(seam, room / pieceSize);
}

function limitDepth(seam: JigsawSeam, maxDepth: number): JigsawSeam {
  return seam.depth <= maxDepth ? seam : { ...seam, depth: maxDepth };
}

/** シードから [0, 1) の一様な乱数列を作る mulberry32。 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function pickInRange({ min, max }: Range, ratio: number): number {
  return min + (max - min) * ratio;
}

function cellKey({ row, column }: Cell): string {
  return `${row}-${column}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export const _private = {
  arrangeBoard,
  createBoardSeams,
  listPiecesInBoardOrder,
  sideDirection,
};
