import {
  type ReflectionDifficulty,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import {
  parseReflectionBoard,
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
import { ReflectionFigureClue } from "@/games/reflection/ui/board/figure/ReflectionFigureClue";
import { ReflectionFigureGrid } from "@/games/reflection/ui/board/figure/ReflectionFigureGrid";
import { ReflectionFigurePiece } from "@/games/reflection/ui/board/figure/ReflectionFigurePiece";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";

/**
 * 難易度プレビューは、1枚の盤面から3行を切り出した「帯」を、レベルごとに少しずつ育てて描く。
 * 実際の問題ではなく、難易度の違いを表す模式図である。光路と外周ヒントはプレイ画面と同じ規則で求める。
 *
 * - 盤面の幅: そのレベルで遊ぶ盤面サイズの上限（`reflectionLevelCombinations`）。
 * - ピース: `pieces` の記法で置き、`levels` の数字のレベルから現れる。上のレベルは下のレベルのピースをすべて同じマスに含む。
 *   数はそのレベルのピース数の範囲に入れる。
 * - 光路: `lights` のレベルから点く。点いている光路の本数がレベルの数と同じになる。
 *   どの光路も帯の中だけを通ってピースに当たり、ほかの光路と同じマスを通ってつながる。
 *   照らし合わせて読む外周ヒントの本数で、推論の深さを表す。
 * - 外周ヒントは点いている光路の両端だけに描く。帯の外へ抜ける光路の数字は、帯だけでは読めないため。
 *
 * ピースが増えると、下のレベルで点いた光路の結末が変わることがある。置くピースが増えると読み直しが要る、というこのゲームの性質のままにしている。
 */
const previewStrip = {
  pieces: ["=\\./.=.", "/..@.\\.", "/\\.=..."],
  levels: ["41.3.5.", "5..2.5.", "41.3..."],
  lights: [
    { side: "left", row: 0, level: 1 },
    { side: "left", row: 1, level: 2 },
    { side: "right", row: 0, level: 3 },
    { side: "left", row: 2, level: 4 },
    { side: "right", row: 1, level: 5 },
  ],
} as const satisfies {
  pieces: readonly string[];
  levels: readonly string[];
  lights: readonly {
    side: "left" | "right";
    row: number;
    level: number;
  }[];
};

const STRIP_ROW_COUNT = previewStrip.pieces.length;
/** 帯の上下に取る余白（マス単位）。枠線の太さぶん。 */
const STRIP_PADDING = 0.05;

type PreviewLight = {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

type PreviewStrip = {
  board: ReflectionBoard;
  /** 帯の1行目が盤面の何行目か。帯は盤面の上下の中ほどに置く。 */
  firstRow: number;
  lights: PreviewLight[];
};

function createPreviewStrip(difficulty: ReflectionDifficulty): PreviewStrip {
  const level = Number(difficulty);
  const size = reflectionLevelCombinations[difficulty].boardSize.maximum;
  const firstRow = Math.floor((size - STRIP_ROW_COUNT) / 2);
  const emptyRow = ".".repeat(size);
  const board = parseReflectionBoard(
    Array.from({ length: size }, function toBoardRow(_, row) {
      const stripRow = row - firstRow;
      const notations = previewStrip.pieces[stripRow];
      const levels = previewStrip.levels[stripRow];
      if (notations === undefined || levels === undefined) return emptyRow;
      return Array.from(notations.slice(0, size), (notation, column) =>
        Number(levels[column]) <= level ? notation : ".",
      ).join("");
    }),
  );
  const lights = previewStrip.lights
    .filter((light) => light.level <= level)
    .map(function traceLight({ side, row }) {
      const entry = { side, index: firstRow + row };
      return { entry, trace: traceReflectionLaser(board, entry) };
    });
  return { board, firstRow, lights };
}

/** 点いている光路の両端の外周ヒント。はね返る光路は入れた位置だけになる。 */
function listLitClues({ board, lights }: PreviewStrip) {
  return lights.flatMap(({ entry, trace }) => [
    { entry, clue: trace },
    ...(trace.outcome === "exit" && trace.exit
      ? [{ entry: trace.exit, clue: traceReflectionLaser(board, trace.exit) }]
      : []),
  ]);
}

type ReflectionDifficultyPreviewProps = {
  difficulty: ReflectionDifficulty;
};

export function ReflectionDifficultyPreview({
  difficulty,
}: ReflectionDifficultyPreviewProps) {
  const strip = createPreviewStrip(difficulty);
  const { board, firstRow, lights } = strip;
  const { size } = board;
  const top = getReflectionBoardOrigin().y + firstRow - STRIP_PADDING;
  const height = STRIP_ROW_COUNT + STRIP_PADDING * 2;

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-36 shrink-0 items-center lg:h-28 lg:w-full lg:justify-center"
    >
      {/* マスの大きさをどのレベルでもそろえるため、高さを固定して盤面の幅ぶん横に伸ばす。高さは、PC の5列並びでも 7×7 の帯が枠に収まる値。 */}
      <svg
        viewBox={`0 ${top} ${getReflectionFigureExtent(size)} ${height}`}
        className="h-[46px] w-auto"
      >
        <ReflectionFigureGrid
          size={size}
          rows={{ first: firstRow, count: STRIP_ROW_COUNT }}
        />
        <g className={reflectionToneClassNames.laserText}>
          {lights.map(({ entry, trace }) => (
            <ReflectionLaserPath
              key={`${entry.side}-${entry.index}`}
              size={size}
              entry={entry}
              trace={trace}
            />
          ))}
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
        {listLitClues(strip).map(({ entry, clue }) => (
          <ReflectionFigureClue
            key={`${entry.side}-${entry.index}`}
            size={size}
            entry={entry}
            clue={clue}
            lit
          />
        ))}
      </svg>
    </span>
  );
}

export const _private = { previewStrip, createPreviewStrip };
