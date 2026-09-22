import {
  complementaryEdge,
  createJigsawPiecePath,
  type JigsawEdge,
  type JigsawEdges,
} from "@/views/NotFoundView/MissingPageJigsaw/jigsawGeometry";

const horizontalSeams: JigsawEdge[][] = [
  ["tab", "blank", "tab", "blank", "tab", "blank"],
  ["blank", "tab", "blank", "tab", "blank", "tab"],
  ["tab", "tab", "blank", "tab", "blank", "blank"],
  ["blank", "tab", "blank", "blank", "tab", "blank"],
  ["tab", "blank", "tab", "blank", "tab", "blank"],
  ["blank", "tab", "blank", "tab", "blank", "tab"],
  ["tab", "blank", "tab", "blank", "tab", "blank"],
];

const verticalSeams: JigsawEdge[][] = [
  ["blank", "tab", "blank", "tab", "blank", "tab", "blank"],
  ["tab", "blank", "tab", "blank", "tab", "blank", "tab"],
  ["blank", "tab", "blank", "tab", "blank", "tab", "blank"],
  ["tab", "blank", "tab", "blank", "tab", "blank", "tab"],
  ["blank", "tab", "blank", "tab", "blank", "tab", "blank"],
  ["tab", "blank", "tab", "blank", "tab", "blank", "tab"],
];

export type GridPiece = {
  column: number;
  path: string;
  row: number;
};

export function buildGridPieces({
  columns,
  rows,
  cellSize,
  originX,
  originY,
  missingCells,
}: {
  columns: number;
  rows: number;
  cellSize: number;
  originX: number;
  originY: number;
  missingCells: ReadonlyArray<{ row: number; column: number }>;
}) {
  const missingKeys = new Set(
    missingCells.map((cell) => `${cell.row}-${cell.column}`),
  );
  const pieces: GridPiece[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (missingKeys.has(`${row}-${column}`)) continue;

      pieces.push({
        column,
        path: createPiecePath({
          row,
          column,
          rows,
          columns,
          cellSize,
          originX,
          originY,
        }),
        row,
      });
    }
  }

  return pieces;
}

export function createPiecePath({
  row,
  column,
  rows,
  columns,
  cellSize,
  originX,
  originY,
}: {
  row: number;
  column: number;
  rows: number;
  columns: number;
  cellSize: number;
  originX: number;
  originY: number;
}) {
  const edges: JigsawEdges = {
    top:
      row === 0
        ? "flat"
        : complementaryEdge(verticalSeams[row - 1]?.[column] ?? "flat"),
    right:
      column === columns - 1
        ? "flat"
        : (horizontalSeams[row]?.[column] ?? "flat"),
    bottom:
      row === rows - 1 ? "flat" : (verticalSeams[row]?.[column] ?? "flat"),
    left:
      column === 0
        ? "flat"
        : complementaryEdge(horizontalSeams[row]?.[column - 1] ?? "flat"),
  };

  return createJigsawPiecePath(
    originX + column * cellSize,
    originY + row * cellSize,
    cellSize,
    edges,
  );
}
