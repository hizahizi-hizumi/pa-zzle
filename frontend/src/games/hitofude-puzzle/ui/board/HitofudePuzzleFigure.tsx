import type { Ref } from "react";

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
  /** 最後に道を延ばせなかった操作が進もうとしたマス。×の印を置き、阻まれたときだけ盤面の反応で点ける。 */
  blockedCell?: number | null;
  /** ×の印を点けたまま描くか。遊び方の図で、阻まれたときの盤面の反応を見せるときに使う。 */
  showsBlockedMark?: boolean;
  /**
   * 上から何行を描くか。省略すると全行を描く。難易度選択の見本で、正方形の枠の上の帯だけを盤面として描くときに使う。
   * 描かない行はすべて穴にしておく（穴は描かれず、外形は帯の下の縁で閉じる）。
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
/**
 * 行き止まりの先端は、通れないものと同じ色で塗った円に、マスの地の色の横棒を通す（進入禁止の標識の形）。
 * 欠けた輪や回る形は読み込み中に見えるので使わない。
 */
const DEAD_END_HEAD_RADIUS = HEAD_RING_RADIUS + HEAD_RING_WIDTH / 2;
const DEAD_END_BAR_HALF_LENGTH = 0.24;
const DEAD_END_BAR_WIDTH = 0.12;
/** クリアしたとき道をなぞる光の太さ。道の線の半分ほどにし、道の色の上で光として読める太さにする。 */
const CLEAR_TRACE_WIDTH = 0.15;
/** クリアしたとき、先端の輪に代えて終点に置く印の半径。始点の印より一回り大きくし、道の両端を結ぶ。 */
const END_MARK_RADIUS = 0.26;
/**
 * 阻まれたマスの×の、中心から端までの長さと太さ。マスの半分ほどに広げ、短く点いても見落とされない大きさにする。
 * 下に敷くマスの地の色の縁で、道の上でも読めるようにする。
 */
const BLOCKED_MARK_REACH = 0.26;
const BLOCKED_MARK_WIDTH = 0.13;
const BLOCKED_MARK_OUTLINE_WIDTH = 0.25;

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
  endMark: "data-end-mark",
  blockedMark: "data-blocked-mark",
} as const;

/**
 * 盤面の絵。マスの塗り・盤面の外形・道・始点・先端を、下から順にこの層で描く。
 * 道が全マスを通り終えたら、先端の輪に代えて終点の印を置き、始点から終点へなぞる光を重ねる。
 * 穴は描かず、盤面の外と同じ地を見せる。外形が、外周の穴を盤面の欠けとして、内側の穴を盤面に開いた穴として縁取る。
 * 道とマスの塗りは、通った順に色を移す（`getPathColor`）。
 */
export function HitofudePuzzleFigure({
  board,
  path,
  isDeadEnd,
  solved,
  blockedCell = null,
  showsBlockedMark = false,
  visibleRowCount,
  ref,
}: HitofudePuzzleFigureProps) {
  const { size } = board;
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
      viewBox={`0 0 ${size} ${visibleRowCount ?? size}`}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-visible",
        hitofudePuzzleToneClassNames.pathColorVariables,
      )}
    >
      {listHitofudePuzzleOpenCells(board).map((cell) => {
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
              order === undefined && hitofudePuzzleToneClassNames.unvisitedCell,
            )}
            style={
              order === undefined
                ? undefined
                : { fill: getVisitedCellColor(progressAt(order)) }
            }
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
      {solved ? (
        <g transform={`translate(${head.x} ${head.y})`}>
          <circle
            {...{ [hitofudePuzzleFigureParts.endMark]: "" }}
            r={END_MARK_RADIUS}
            strokeWidth={START_MARK_OUTLINE_WIDTH}
            className={hitofudePuzzleToneClassNames.startMarkOutline}
            style={{ fill: headColor }}
          />
        </g>
      ) : (
        <g transform={`translate(${head.x} ${head.y})`}>
          {/* 揺れは CSS の transform で動かすので、位置の transform 属性とは別の要素に置く。 */}
          <g {...{ [hitofudePuzzleFigureParts.head]: "" }}>
            {isDeadEnd ? (
              <>
                <circle
                  r={DEAD_END_HEAD_RADIUS}
                  className={hitofudePuzzleToneClassNames.deadEndHead}
                />
                <rect
                  x={-DEAD_END_BAR_HALF_LENGTH}
                  y={-DEAD_END_BAR_WIDTH / 2}
                  width={DEAD_END_BAR_HALF_LENGTH * 2}
                  height={DEAD_END_BAR_WIDTH}
                  className={hitofudePuzzleToneClassNames.deadEndBar}
                />
              </>
            ) : (
              <circle
                r={HEAD_RING_RADIUS}
                fill="none"
                strokeWidth={HEAD_RING_WIDTH}
                style={{ stroke: headColor }}
              />
            )}
          </g>
        </g>
      )}
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
