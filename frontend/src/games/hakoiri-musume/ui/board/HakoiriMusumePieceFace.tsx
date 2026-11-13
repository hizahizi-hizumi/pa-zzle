import {
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import { getPieceOutline } from "@/games/hakoiri-musume/ui/board/board-geometry";
import {
  getWoodPieceBackground,
  hakoiriMusumeToneClassNames,
} from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

type HakoiriMusumePieceFaceProps = {
  kind: HakoiriMusumePieceKind;
  /** 目標の駒なら何番目の目標か。ほかの駒は `null`。 */
  target: number | null;
  /** 盤の目標の駒の数。目標が2つなら字を「姉」「妹」にする。 */
  targetCount: number;
  /** 1マスの幅（箱の外形の幅に対する cqw）。角の丸みと字の大きさをマスの大きさにそろえる。 */
  cellCqw: number;
  /** 木目の模様と地の明るさを駒ごとに変える種（0 以上の整数）。同じ盤面の駒には別々の値を渡す。 */
  grainSeed?: number;
};

/** 小駒の木目の向きを散らすための、種ごとの並び。 */
const SMALL_PIECE_GRAIN_ANGLES = [0, 90, 90, 0] as const;

/** 角の丸み（マス幅に対する割合）。 */
const CORNER_RADIUS_CELLS = 0.105;

/** 目標の駒の字の大きさ（マス幅に対する割合）。2マス幅以上の駒は大きく、1マス幅の腕しかない駒は腕に収める。 */
const TARGET_MARK_CELLS = { wide: 0.75, narrow: 0.6 } as const;

function getGrainAngle(kind: HakoiriMusumePieceKind, seed: number): 0 | 90 {
  const { columns, rows } = hakoiriMusumePieceShapes[kind];
  if (rows > columns) {
    return 0;
  }
  if (columns > rows) {
    return 90;
  }
  return SMALL_PIECE_GRAIN_ANGLES[seed % SMALL_PIECE_GRAIN_ANGLES.length]!;
}

export function getHakoiriMusumeTargetMark(
  target: number,
  targetCount: number,
): string {
  if (targetCount === 1) {
    return "娘";
  }
  return target === 0 ? "姉" : "妹";
}

/** 駒の占めるマスの中心の平均（外接矩形に対する %）。字を、L字でも駒の上に置く。 */
function getCellsCenter(kind: HakoiriMusumePieceKind) {
  const { cells, columns, rows } = hakoiriMusumePieceShapes[kind];
  const average = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    left: ((average(cells.map((cell) => cell.column)) + 0.5) / columns) * 100,
    top: ((average(cells.map((cell) => cell.row)) + 0.5) / rows) * 100,
  };
}

/**
 * 駒の面。置かれた所いっぱいに描き、L字は占めるマスの形に切り抜く。目標の駒だけは漆を塗って金の字を入れる。
 * 欅の駒には、うねりと節のある木目を駒ごとに違えて入れ、縦長は縦に、横長は横に木目を通す。
 */
export function HakoiriMusumePieceFace({
  kind,
  target,
  targetCount,
  cellCqw,
  grainSeed = 0,
}: HakoiriMusumePieceFaceProps) {
  const shape = hakoiriMusumePieceShapes[kind];
  const outline = getPieceOutline(shape);
  const frame = {
    borderRadius: outline ? undefined : `${cellCqw * CORNER_RADIUS_CELLS}cqw`,
    clipPath: outline ?? undefined,
  };
  if (target !== null) {
    const center = getCellsCenter(kind);
    const wide = outline === null && Math.min(shape.columns, shape.rows) >= 2;
    return (
      <span
        className={`relative block size-full ${hakoiriMusumeToneClassNames.targetPieces[target]}`}
        style={frame}
      >
        <span
          className={`absolute -translate-1/2 font-['Hiragino_Mincho_ProN','Yu_Mincho','Noto_Serif_JP',serif] leading-none ${hakoiriMusumeToneClassNames.targetMark}`}
          style={{
            left: `${center.left}%`,
            top: `${center.top}%`,
            fontSize: `${cellCqw * TARGET_MARK_CELLS[wide ? "wide" : "narrow"]}cqw`,
          }}
        >
          {getHakoiriMusumeTargetMark(target, targetCount)}
        </span>
      </span>
    );
  }
  return (
    <span
      className={`block size-full ${hakoiriMusumeToneClassNames.woodPiece}`}
      style={{
        ...frame,
        background: getWoodPieceBackground(
          shape,
          getGrainAngle(kind, grainSeed),
          grainSeed,
        ),
      }}
    />
  );
}
