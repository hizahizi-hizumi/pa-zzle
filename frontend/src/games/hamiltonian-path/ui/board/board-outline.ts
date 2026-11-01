import {
  getHamiltonianPathCellPosition,
  getHamiltonianPathNeighborCell,
  type HamiltonianPathBoard,
  type HamiltonianPathDirection,
  hamiltonianPathDirections,
  listHamiltonianPathOpenCells,
} from "@/games/hamiltonian-path/puzzle/board";

/** 盤面の外形の1辺。図の座標（マス幅 1、枠の左上が原点）の線分。 */
export type HamiltonianPathOutlineEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** マスの左上を原点とした、各向きの辺の両端。 */
const cellSides = {
  up: { x1: 0, y1: 0, x2: 1, y2: 0 },
  right: { x1: 1, y1: 0, x2: 1, y2: 1 },
  down: { x1: 0, y1: 1, x2: 1, y2: 1 },
  left: { x1: 0, y1: 0, x2: 0, y2: 1 },
} as const satisfies Record<
  HamiltonianPathDirection,
  HamiltonianPathOutlineEdge
>;

/**
 * 盤面の外形。道が通るマスの辺のうち、穴か枠の外に接する辺。
 * 外周の穴は外形の欠けとして、内側の穴は盤面に開いた穴の縁として、同じ規則で表れる。
 */
export function listHamiltonianPathOutlineEdges(
  board: HamiltonianPathBoard,
): HamiltonianPathOutlineEdge[] {
  const holes = new Set(board.holes);
  return listHamiltonianPathOpenCells(board).flatMap(
    function edgesFacingNoCell(cell) {
      const { row, column } = getHamiltonianPathCellPosition(board.size, cell);
      return hamiltonianPathDirections
        .filter((direction) => {
          const neighbor = getHamiltonianPathNeighborCell(
            board.size,
            cell,
            direction,
          );
          return neighbor === null || holes.has(neighbor);
        })
        .map((direction) => {
          const side = cellSides[direction];
          return {
            x1: column + side.x1,
            y1: row + side.y1,
            x2: column + side.x2,
            y2: row + side.y2,
          };
        });
    },
  );
}

/** 外形の辺を、SVG の `path` の `d` にする。 */
export function formatHamiltonianPathOutlinePath(
  edges: readonly HamiltonianPathOutlineEdge[],
): string {
  return edges.map(({ x1, y1, x2, y2 }) => `M${x1} ${y1}L${x2} ${y2}`).join("");
}
