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
 * - 光: 帯の上の行へ左の外周から1本だけ入れる。左から1列ずつ、上下に並べた鏡の組を置き、光は組ごとに2回折れて段を下りる・上る。
 *   組の数はレベルが上がるほど増え（ピースはそのレベルのピース数の範囲に入る）、折れる回数（たどる光路の長さ）で読みの深さを表す。
 *   上のレベルは下のレベルの鏡をすべて同じマスに含み、光路は下のレベルの光路の続きになる。
 * - 色は光路とピース（斜め鏡）の2色だけにし、外周ヒントの数字・結果の形は描かない。
 */
const previewStrip = {
  rowCount: 2,
  /** 鏡の組を置く最初の列。組は左から1列ずつ、上下のマスに同じ向きの斜め鏡を置き、1組目は右下がり、2組目は右上がりと交互にする。 */
  firstPairColumn: 1,
  /** レベルごとの鏡の組の数。ピース数（組の数 × 2）はそのレベルのピース数の範囲に入れる。 */
  pairCounts: { "1": 1, "2": 2, "3": 3, "4": 5, "5": 9 },
} as const satisfies {
  rowCount: number;
  firstPairColumn: number;
  pairCounts: Record<ReflectionDifficulty, number>;
};

/** 帯の外枠の太さ（マス単位）。外枠はプレイ画面と同じく帯の外側に描き、帯の縁で止める光路の端の印と重ねない。 */
const FRAME_WIDTH = 0.05;
/** 図の上下と左右で、帯の外枠の外に残す余白（マス単位）。 */
const STRIP_PADDING = 0.08;
/** 左右の外周ヒントの帯と隙間を、外枠と余白だけを残して切り落とす幅（マス単位）。光路と端の印は帯の内側に収まる。 */
const CLUE_CROP = getReflectionBoardOrigin().x - FRAME_WIDTH - STRIP_PADDING;

type PreviewStrip = {
  board: ReflectionBoard;
  /** 帯の1行目が盤面の何行目か。帯は盤面の上下の中ほどに置く。 */
  firstRow: number;
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

function createPreviewStrip(difficulty: ReflectionDifficulty): PreviewStrip {
  const size = reflectionLevelCombinations[difficulty].boardSize.maximum;
  const firstRow = Math.floor((size - previewStrip.rowCount) / 2);
  const cells = [...createEmptyReflectionBoard(size).cells];
  for (
    let pairIndex = 0;
    pairIndex < previewStrip.pairCounts[difficulty];
    pairIndex++
  ) {
    const column = previewStrip.firstPairColumn + pairIndex;
    const piece = pairIndex % 2 === 0 ? "backslash" : "slash";
    for (let row = firstRow; row < firstRow + previewStrip.rowCount; row++) {
      cells[row * size + column] = piece;
    }
  }
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
      // 最も広いレベルの帯がプレビュー枠（128px）に収まるマスの大きさにする。
      className="flex h-14 w-full items-center [--preview-unit:11px] lg:h-28 lg:justify-center lg:[--preview-unit:12px]"
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
          x={origin.x - FRAME_WIDTH / 2}
          y={origin.y + firstRow - FRAME_WIDTH / 2}
          width={size + FRAME_WIDTH}
          height={previewStrip.rowCount + FRAME_WIDTH}
          className="fill-background stroke-foreground/35"
          strokeWidth={FRAME_WIDTH}
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
