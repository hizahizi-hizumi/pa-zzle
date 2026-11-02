import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import {
  type HamiltonianPathBoard as HamiltonianPathBoardState,
  listHamiltonianPathCells,
} from "@/games/hamiltonian-path/puzzle/board";
import { HamiltonianPathBoardFigure } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/HamiltonianPathBoardFigure";
import {
  HamiltonianPathCell,
  type HamiltonianPathCellState,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/HamiltonianPathCell";

type HamiltonianPathBoardProps = {
  board: HamiltonianPathBoardState;
  /** 始点から先端までに通ったマスの番号。 */
  path: readonly number[];
  interactionDisabled: boolean;
  onExtendPath: (cell: number) => void;
  onRewindPath: (cell: number) => void;
};

/**
 * 盤面。マスを押すと、道の途中のマス（始点を含む）ならそこまで巻き戻し、それ以外は先端からそのマスへ延ばす。
 * 延ばせないマス（離れたマス・壁・仕切りの向こう・先端そのもの）を押しても道は変わらない。
 */
export function HamiltonianPathBoard({
  board,
  path,
  interactionDisabled,
  onExtendPath,
  onRewindPath,
}: HamiltonianPathBoardProps) {
  const { size } = board;
  const walls = new Set(board.walls);
  const visited = new Set(path);
  const head = path.at(-1);

  function getCellState(cell: number): HamiltonianPathCellState {
    if (walls.has(cell)) return "wall";
    return visited.has(cell) ? "visited" : "unvisited";
  }

  function selectCell(cell: number): void {
    if (visited.has(cell) && cell !== head) {
      onRewindPath(cell);
    } else {
      onExtendPath(cell);
    }
  }

  return (
    <div
      role="group"
      aria-label={`${HAMILTONIAN_PATH_DISPLAY_NAME}盤面`}
      className="relative size-full"
    >
      <HamiltonianPathBoardFigure board={board} path={path} />
      <div
        className="relative grid size-full"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {listHamiltonianPathCells(size).map((cell) => (
          <HamiltonianPathCell
            key={cell}
            size={size}
            cell={cell}
            state={getCellState(cell)}
            isStart={cell === board.start}
            isHead={cell === head}
            disabled={interactionDisabled}
            onSelect={selectCell}
          />
        ))}
      </div>
    </div>
  );
}
