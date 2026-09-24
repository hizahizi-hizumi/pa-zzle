import {
  createWholePageJigsawPiecePath,
  reverseWholePageJigsawSeam,
  type WholePageJigsawSeam,
} from "@/views/NotFoundView/MissingPageJigsaw/wholePageJigsawGeometry";

export type WholePageJigsawPiece = {
  column: number;
  path: string;
  row: number;
  x: number;
  y: number;
};

export type WholePageJigsawLayout = {
  digitFontSize: number;
  digitX: number;
  digitY: number;
  missingPieces: WholePageJigsawPiece[];
  pieceSize: number;
  pieces: WholePageJigsawPiece[];
};

type Cell = {
  column: number;
  row: number;
};

export function createWholePageJigsawLayout(
  width: number,
  height: number,
): WholePageJigsawLayout {
  const pieceSize = width < 640 ? 46 : 64;
  const columns = Math.ceil(width / pieceSize) + 2;
  const rows = Math.ceil(height / pieceSize) + 2;
  const originX = (width - columns * pieceSize) / 2;
  const originY = -pieceSize * 0.42;

  const digitFontSize = clamp(width * 0.28, 108, 140);
  const digitX = width / 2 - digitFontSize * 1.08;
  const digitY = clamp(height * 0.28, 190, 244);
  const zeroCenterX = digitX + digitFontSize * 1.04;
  const zeroCenterY = digitY - digitFontSize * 0.42;

  const upperZeroCell = pointToCell(
    zeroCenterX - digitFontSize * 0.18,
    zeroCenterY - digitFontSize * 0.22,
    originX,
    originY,
    pieceSize,
    columns,
    rows,
  );
  const lowerZeroCell = pointToCell(
    zeroCenterX + digitFontSize * 0.18,
    zeroCenterY + digitFontSize * 0.22,
    originX,
    originY,
    pieceSize,
    columns,
    rows,
  );
  const missingCells = ensureTwoCells(
    upperZeroCell,
    lowerZeroCell,
    columns,
    rows,
  );
  const missingKeys = new Set(
    missingCells.map((cell) => `${cell.row}-${cell.column}`),
  );

  const pieces: WholePageJigsawPiece[] = [];
  const missingPieces: WholePageJigsawPiece[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const piece = createPiece({
        row,
        column,
        rows,
        columns,
        originX,
        originY,
        pieceSize,
      });

      if (missingKeys.has(`${row}-${column}`)) {
        missingPieces.push(piece);
      } else {
        pieces.push(piece);
      }
    }
  }

  return {
    digitFontSize,
    digitX,
    digitY,
    missingPieces,
    pieceSize,
    pieces,
  };
}

function createPiece({
  row,
  column,
  rows,
  columns,
  originX,
  originY,
  pieceSize,
}: {
  row: number;
  column: number;
  rows: number;
  columns: number;
  originX: number;
  originY: number;
  pieceSize: number;
}): WholePageJigsawPiece {
  const x = originX + column * pieceSize;
  const y = originY + row * pieceSize;

  return {
    column,
    path: createWholePageJigsawPiecePath(x, y, pieceSize, {
      top:
        row === 0
          ? null
          : reverseWholePageJigsawSeam(verticalSeam(row - 1, column)),
      right: column === columns - 1 ? null : horizontalSeam(row, column),
      bottom: row === rows - 1 ? null : verticalSeam(row, column),
      left:
        column === 0
          ? null
          : reverseWholePageJigsawSeam(horizontalSeam(row, column - 1)),
    }),
    row,
    x,
    y,
  };
}

function horizontalSeam(row: number, column: number): WholePageJigsawSeam {
  return seamFromHash(row, column, 17);
}

function verticalSeam(row: number, column: number): WholePageJigsawSeam {
  return seamFromHash(row, column, 53);
}

function seamFromHash(
  row: number,
  column: number,
  salt: number,
): WholePageJigsawSeam {
  const hash =
    Math.imul(row + 11, 73856093) ^
    Math.imul(column + 17, 19349663) ^
    Math.imul(salt, 83492791);
  const unsignedHash = hash >>> 0;
  const centers = [0.43, 0.47, 0.52, 0.57] as const;
  const depths = [0.21, 0.23, 0.25, 0.27] as const;
  const widths = [0.3, 0.34, 0.38] as const;

  return {
    center: centers[(unsignedHash >>> 2) % centers.length] ?? 0.5,
    depth: depths[(unsignedHash >>> 5) % depths.length] ?? 0.2,
    direction: unsignedHash % 2 === 0 ? 1 : -1,
    width: widths[(unsignedHash >>> 8) % widths.length] ?? 0.28,
  };
}

function pointToCell(
  x: number,
  y: number,
  originX: number,
  originY: number,
  pieceSize: number,
  columns: number,
  rows: number,
): Cell {
  return {
    column: clampInteger(Math.floor((x - originX) / pieceSize), 0, columns - 1),
    row: clampInteger(Math.floor((y - originY) / pieceSize), 0, rows - 1),
  };
}

function ensureTwoCells(
  first: Cell,
  second: Cell,
  columns: number,
  rows: number,
): Cell[] {
  if (first.row !== second.row || first.column !== second.column) {
    return [first, second];
  }

  if (second.row + 1 < rows) {
    return [first, { row: second.row + 1, column: second.column }];
  }
  if (second.row > 0) {
    return [first, { row: second.row - 1, column: second.column }];
  }

  return [
    first,
    {
      row: second.row,
      column: clampInteger(second.column + 1, 0, columns - 1),
    },
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(clamp(value, minimum, maximum));
}
