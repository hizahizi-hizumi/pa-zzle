import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";

// 実際の盤面を縮めた見本。"*"が地雷。
// レベルが上がるほど盤面を大きく、地雷の割合をそのレベルの地雷密度の範囲で高くする。
const previewMineLayouts = {
  "1": ["....", "..*.", "*...", "...."],
  "2": ["...*", ".*..", "....", "..*.", "...."],
  "3": [".*...", "....*", "*....", "...*.", "....."],
  "4": ["..*..", "*...*", ".....", ".*...", "....*", "....."],
  "5": [".*..*.", "...*..", "*.....", "..*..*", "......", ".*...."],
} satisfies Record<MinesweeperDifficulty, readonly string[]>;

// 最大の6行でプレビュー枠の高さ48pxに収まる、1マスあたりの間隔。
const CELL_PITCH_PX = 8;
const CELL_SIZE_PX = 7;
const MINE_RADIUS_PX = 2;

type PreviewCell = { key: string; x: number; y: number; isMine: boolean };

function toPreviewCells(layout: readonly string[]): PreviewCell[] {
  return layout.flatMap(function toRowCells(rowMarks, row) {
    return Array.from(rowMarks, function toCell(mark, column) {
      return {
        key: `${row}-${column}`,
        x: column * CELL_PITCH_PX,
        y: row * CELL_PITCH_PX,
        isMine: mark === "*",
      };
    });
  });
}

function toPixelLength(cellCount: number): number {
  return cellCount * CELL_PITCH_PX - (CELL_PITCH_PX - CELL_SIZE_PX);
}

type MinesweeperDifficultyPreviewProps = {
  difficulty: MinesweeperDifficulty;
};

export function MinesweeperDifficultyPreview({
  difficulty,
}: MinesweeperDifficultyPreviewProps) {
  const layout = previewMineLayouts[difficulty];
  const width = toPixelLength(layout[0]?.length ?? 0);
  const height = toPixelLength(layout.length);
  const cells = toPreviewCells(layout);

  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-32 shrink-0 items-center lg:justify-center"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {cells.map(function renderCell({ key, x, y, isMine }) {
          return (
            <g key={key}>
              <rect
                x={x}
                y={y}
                width={CELL_SIZE_PX}
                height={CELL_SIZE_PX}
                rx={1}
                className="fill-slate-300 dark:fill-slate-700"
              />
              {isMine ? (
                <circle
                  cx={x + CELL_SIZE_PX / 2}
                  cy={y + CELL_SIZE_PX / 2}
                  r={MINE_RADIUS_PX}
                  className="fill-slate-800 dark:fill-slate-200"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </span>
  );
}

export const _private = { previewMineLayouts };
