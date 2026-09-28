import {
  type ReflectionDifficulty,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import {
  createEmptyReflectionBoard,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  type ReflectionLaserTrace,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  getReflectionBoardOrigin,
  getReflectionFigureExtent,
} from "@/games/reflection/ui/board/board-geometry";
import { ReflectionFigurePiece } from "@/games/reflection/ui/board/figure/ReflectionFigurePiece";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";

/**
 * 難易度プレビューは、盤面の中ほどの2行を切り出した「帯」を、1本の光が鏡で上下に折れながら横切る模式図である。実際の問題ではない。
 *
 * - 帯の幅: そのレベルで遊ぶ盤面サイズの上限（`reflectionLevelCombinations`）。マスの大きさはどのレベルでもそろえる。
 * - 光: 帯の上の行へ左の外周から1本だけ入れる。左から1列ずつ、上下に並べた鏡の組をレベルの数だけ置き、
 *   光は組ごとに2回折れて段を下りる・上る。折れる回数（たどる光路の長さ）で、読みの深さを表す。
 *   上のレベルは下のレベルの鏡をすべて同じマスに含み、光路は下のレベルの光路の続きになる。
 * - 色は光路とピース（斜め鏡）の2色だけにし、外周ヒントの数字・結果の形は描かない。
 */
const previewStrip = {
  rowCount: 2,
  /** 鏡の組を置く列。組は上下のマスに同じ向きの斜め鏡を置き、1組目は右下がり、2組目は右上がりと交互にする。 */
  pairColumns: [1, 2, 3, 4, 5],
} as const;

/** 図の上下と左右で、帯・入口の点・出口の矢印の外に残す余白（マス単位）。 */
const STRIP_PADDING = 0.08;
/** 左右の外周ヒントの帯のうち、入口の点と出口の矢印に要る幅だけを残して切り落とす幅（マス単位）。 */
const CLUE_CROP = 0.62;

type PreviewStrip = {
  board: ReflectionBoard;
  /** 帯の1行目が盤面の何行目か。帯は盤面の上下の中ほどに置く。 */
  firstRow: number;
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

function createPreviewStrip(difficulty: ReflectionDifficulty): PreviewStrip {
  const level = Number(difficulty);
  const size = reflectionLevelCombinations[difficulty].boardSize.maximum;
  const firstRow = Math.floor((size - previewStrip.rowCount) / 2);
  const cells = [...createEmptyReflectionBoard(size).cells];
  previewStrip.pairColumns.slice(0, level).forEach((column, pairIndex) => {
    const piece = pairIndex % 2 === 0 ? "backslash" : "slash";
    for (let row = firstRow; row < firstRow + previewStrip.rowCount; row++) {
      cells[row * size + column] = piece;
    }
  });
  const board = { size, cells };
  const entry = { side: "left", index: firstRow } as const;
  return { board, firstRow, entry, trace: traceReflectionLaser(board, entry) };
}

type ReflectionDifficultyPreviewProps = {
  difficulty: ReflectionDifficulty;
};

export function ReflectionDifficultyPreview({
  difficulty,
}: ReflectionDifficultyPreviewProps) {
  const { board, firstRow, entry, trace } = createPreviewStrip(difficulty);
  const { size } = board;
  const origin = getReflectionBoardOrigin();
  const top = origin.y + firstRow - STRIP_PADDING;
  const height = previewStrip.rowCount + STRIP_PADDING * 2;
  const width = getReflectionFigureExtent(size) - CLUE_CROP * 2;

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-36 shrink-0 items-center [--preview-unit:17px] lg:h-28 lg:w-full lg:justify-center lg:[--preview-unit:20px]"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の幅を帯の列の数に比例させる。 */}
      <svg
        viewBox={`${CLUE_CROP} ${top} ${width} ${height}`}
        style={{
          width: `calc(var(--preview-unit) * ${width})`,
          height: `calc(var(--preview-unit) * ${height})`,
        }}
      >
        <rect
          x={origin.x}
          y={origin.y + firstRow}
          width={size}
          height={previewStrip.rowCount}
          className="fill-background stroke-foreground/35"
          strokeWidth={0.05}
        />
        <g className={reflectionToneClassNames.laserText}>
          <ReflectionLaserPath size={size} entry={entry} trace={trace} />
        </g>
        {board.cells.map(function renderPiece(cell, cellIndex) {
          return cell === null ? null : (
            <ReflectionFigurePiece
              // biome-ignore lint/suspicious/noArrayIndexKey: マスの位置で決まる
              key={cellIndex}
              size={size}
              cellIndex={cellIndex}
              piece={cell}
            />
          );
        })}
      </svg>
    </span>
  );
}

export const _private = { previewStrip, createPreviewStrip };
