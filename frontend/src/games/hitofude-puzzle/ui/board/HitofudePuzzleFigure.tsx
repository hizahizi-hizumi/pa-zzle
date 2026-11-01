import { type Ref, useId } from "react";

import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  formatHitofudePuzzleOutlinePath,
  listHitofudePuzzleOutlineEdges,
} from "@/games/hitofude-puzzle/ui/board/board-outline";
import {
  getPathColor,
  getVisitedCellColor,
  hitofudePuzzleToneClassNames,
} from "@/games/hitofude-puzzle/ui/hitofude-puzzle-tone";
import { cn } from "@/lib/utils";

type HitofudePuzzleFigureProps = {
  board: HitofudePuzzleBoard;
  /** 始点から先端までに通ったマスの番号。 */
  path: readonly number[];
  /** 全マスを通る前に、先端から延ばせるマスが無くなったか。 */
  isDeadEnd: boolean;
  /** 道が全マスを通り終えたか。始点から終点へ道をなぞる光を描く。 */
  solved: boolean;
  /** 取り残しとして斜線を引くマス。 */
  strandedCells?: readonly number[];
  /** 最後に道を延ばせなかった操作が進もうとしたマス。×の印を置き、阻まれたときだけ盤面の反応で点ける。 */
  blockedCell?: number | null;
  /** ×の印を点けたまま描くか。遊び方の図で、阻まれたときの盤面の反応を見せるときに使う。 */
  showsBlockedMark?: boolean;
  /**
   * 上から何行を描くか。省略すると全行を描く。難易度プレビューで、盤面の上の帯だけを切り出すときに使う。
   * 描かない行のマスは描かない。道・始点・先端は描く行の中に置く。
   */
  visibleRowCount?: number;
  ref?: Ref<SVGSVGElement>;
};

/** 図の寸法はマス幅を 1 とした値。 */
const PATH_LINE_WIDTH = 0.3;
const START_MARK_RADIUS = 0.2;
const START_MARK_OUTLINE_WIDTH = 0.07;
/** 先端は指に隠れるので、マス幅に対して大きめの輪にする。道が始点だけのときも、輪の内に始点の印が見える。 */
const HEAD_RING_RADIUS = 0.37;
const HEAD_RING_WIDTH = 0.09;
/** 行き止まりの先端は、通れないものと同じ色の太い輪を、はっきり分かれた4つの弧に欠けさせる。 */
const DEAD_END_HEAD_RING_WIDTH = 0.13;
const DEAD_END_HEAD_DASH = "0.36 0.22";
const CLEAR_TRACE_WIDTH = 0.1;
/** 阻まれたマスの×の、中心から端までの長さと太さ。下に敷くマスの地の色の縁で、道の上でも読めるようにする。 */
const BLOCKED_MARK_REACH = 0.2;
const BLOCKED_MARK_WIDTH = 0.1;
const BLOCKED_MARK_OUTLINE_WIDTH = 0.2;
/** 取り残しのマスの斜線の間隔と太さ。マス幅に4本ほど入り、未通過のマスの地と見分けられる密度にする。 */
const STRANDED_HATCH_GAP = 0.25;
const STRANDED_HATCH_WIDTH = 0.06;

/** 阻まれたマスの×の2本の線。マスの中心を原点に描く。 */
const blockedMarkStrokes = (
  <>
    <line
      x1={-BLOCKED_MARK_REACH}
      y1={-BLOCKED_MARK_REACH}
      x2={BLOCKED_MARK_REACH}
      y2={BLOCKED_MARK_REACH}
    />
    <line
      x1={-BLOCKED_MARK_REACH}
      y1={BLOCKED_MARK_REACH}
      x2={BLOCKED_MARK_REACH}
      y2={-BLOCKED_MARK_REACH}
    />
  </>
);

function getCellCenter(size: number, cell: number): { x: number; y: number } {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  return { x: column + 0.5, y: row + 0.5 };
}

/** 盤面の要素を、盤面の反応や演出から探すための印。 */
export const hitofudePuzzleFigureParts = {
  outline: "data-outline",
  head: "data-head",
  clearTrace: "data-clear-trace",
  strandedCell: "data-stranded-cell",
  blockedMark: "data-blocked-mark",
} as const;

/**
 * 盤面の絵。マスの塗り・取り残しの斜線・盤面の外形・道・始点・先端を、下から順にこの層で描く。
 * 穴は描かず、盤面の外と同じ地を見せる。外形が、外周の穴を盤面の欠けとして、内側の穴を盤面に開いた穴として縁取る。
 * 道とマスの塗りは、通った順に色を移す（`getPathColor`）。
 */
export function HitofudePuzzleFigure({
  board,
  path,
  isDeadEnd,
  solved,
  strandedCells = [],
  blockedCell = null,
  showsBlockedMark = false,
  visibleRowCount,
  ref,
}: HitofudePuzzleFigureProps) {
  const strandedHatchId = useId();
  const { size } = board;
  const rowCount = visibleRowCount ?? size;
  function isVisibleCell(cell: number): boolean {
    return getHitofudePuzzleCellPosition(size, cell).row < rowCount;
  }
  const lastProgressIndex = Math.max(
    1,
    listHitofudePuzzleOpenCells(board).length - 1,
  );
  const progressAt = (index: number) => index / lastProgressIndex;
  const visitedOrder = new Map(path.map((cell, index) => [cell, index]));
  const start = getCellCenter(size, board.start);
  const headIndex = path.length - 1;
  const head = getCellCenter(size, path[headIndex] ?? board.start);
  const headColor = getPathColor(progressAt(headIndex));
  const centers = path.map((cell) => getCellCenter(size, cell));
  const blockedMarkCenter =
    blockedCell === null ? null : getCellCenter(size, blockedCell);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${size} ${rowCount}`}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-visible",
        hitofudePuzzleToneClassNames.pathColorVariables,
      )}
    >
      <defs>
        <pattern
          id={strandedHatchId}
          width={STRANDED_HATCH_GAP}
          height={STRANDED_HATCH_GAP}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={STRANDED_HATCH_GAP}
            strokeWidth={STRANDED_HATCH_WIDTH}
            className={hitofudePuzzleToneClassNames.strandedHatch}
          />
        </pattern>
      </defs>
      {listHitofudePuzzleOpenCells(board)
        .filter(isVisibleCell)
        .map((cell) => {
          const { row, column } = getHitofudePuzzleCellPosition(size, cell);
          const order = visitedOrder.get(cell);
          return (
            <rect
              key={cell}
              x={column}
              y={row}
              width={1}
              height={1}
              vectorEffect="non-scaling-stroke"
              className={cn(
                hitofudePuzzleToneClassNames.gridLine,
                order === undefined &&
                  hitofudePuzzleToneClassNames.unvisitedCell,
              )}
              style={
                order === undefined
                  ? undefined
                  : { fill: getVisitedCellColor(progressAt(order)) }
              }
            />
          );
        })}
      {strandedCells.filter(isVisibleCell).map((cell) => {
        const { row, column } = getHitofudePuzzleCellPosition(size, cell);
        return (
          <rect
            key={`stranded-${cell}`}
            {...{ [hitofudePuzzleFigureParts.strandedCell]: cell }}
            x={column}
            y={row}
            width={1}
            height={1}
            fill={`url(#${strandedHatchId})`}
          />
        );
      })}
      <path
        {...{ [hitofudePuzzleFigureParts.outline]: "" }}
        d={formatHitofudePuzzleOutlinePath(
          listHitofudePuzzleOutlineEdges(board),
        )}
        fill="none"
        // 外形は辺ごとの線分なので、線端を四角く伸ばして角の継ぎ目を埋める。
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
        className={hitofudePuzzleToneClassNames.outline}
      />
      {centers.slice(1).map((to, index) => {
        const from = centers[index]!;
        return (
          <line
            // 道の何本目の線かで、通った順の色が決まる。
            // biome-ignore lint/suspicious/noArrayIndexKey: 道の線は並び順そのものが識別になる
            key={index}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={PATH_LINE_WIDTH}
            strokeLinecap="round"
            style={{ stroke: getPathColor(progressAt(index + 0.5)) }}
          />
        );
      })}
      {solved ? (
        <polyline
          {...{ [hitofudePuzzleFigureParts.clearTrace]: "" }}
          points={centers.map(({ x, y }) => `${x},${y}`).join(" ")}
          pathLength={1}
          strokeDasharray="1 1"
          fill="none"
          strokeWidth={CLEAR_TRACE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={hitofudePuzzleToneClassNames.clearTrace}
        />
      ) : null}
      <circle
        cx={start.x}
        cy={start.y}
        r={START_MARK_RADIUS}
        strokeWidth={START_MARK_OUTLINE_WIDTH}
        className={hitofudePuzzleToneClassNames.startMarkOutline}
        style={{ fill: getPathColor(0) }}
      />
      <g transform={`translate(${head.x} ${head.y})`}>
        {/* 揺れは CSS の transform で動かすので、位置の transform 属性とは別の要素に置く。 */}
        <g {...{ [hitofudePuzzleFigureParts.head]: "" }}>
          <circle
            r={HEAD_RING_RADIUS}
            fill="none"
            strokeWidth={isDeadEnd ? DEAD_END_HEAD_RING_WIDTH : HEAD_RING_WIDTH}
            strokeDasharray={isDeadEnd ? DEAD_END_HEAD_DASH : undefined}
            className={
              isDeadEnd ? hitofudePuzzleToneClassNames.deadEndHead : undefined
            }
            style={isDeadEnd ? undefined : { stroke: headColor }}
          />
        </g>
      </g>
      {blockedMarkCenter === null ? null : (
        <g
          {...{ [hitofudePuzzleFigureParts.blockedMark]: "" }}
          transform={`translate(${blockedMarkCenter.x} ${blockedMarkCenter.y})`}
          opacity={showsBlockedMark ? 1 : 0}
          strokeLinecap="round"
        >
          <g
            strokeWidth={BLOCKED_MARK_OUTLINE_WIDTH}
            className={hitofudePuzzleToneClassNames.blockedMarkOutline}
          >
            {blockedMarkStrokes}
          </g>
          <g strokeWidth={BLOCKED_MARK_WIDTH} style={{ stroke: headColor }}>
            {blockedMarkStrokes}
          </g>
        </g>
      )}
    </svg>
  );
}
