import {
  getReflectionCellPosition,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  listReflectionEntries,
  type ReflectionEntry,
  type ReflectionLaserTrace,
  type ReflectionSide,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";

/**
 * 盤面の図の寸法。マス1辺を1とし、外周ヒントの帯・盤面との隙間・盤面を並べる。
 * 隙間は、外周ヒントと端のマスを押し分けられるように取る。
 */
const CLUE_TRACK = 0.8;
const GAP_TRACK = 0.2;
const BOARD_OFFSET = CLUE_TRACK + GAP_TRACK;

export type ReflectionPoint = { x: number; y: number };

/** 図全体の1辺の長さ（マス単位）。 */
export function getReflectionFigureExtent(size: number): number {
  return size + BOARD_OFFSET * 2;
}

/** CSS grid の行・列の並び。外周ヒント・隙間・盤面・隙間・外周ヒントの順。 */
export function getReflectionFigureTracks(size: number): string {
  return `${CLUE_TRACK}fr ${GAP_TRACK}fr repeat(${size}, minmax(0, 1fr)) ${GAP_TRACK}fr ${CLUE_TRACK}fr`;
}

/** 盤面を置く grid の位置（1始まりの線番号）。 */
export function getReflectionBoardGridArea(size: number): {
  gridRow: string;
  gridColumn: string;
} {
  return { gridRow: `3 / span ${size}`, gridColumn: `3 / span ${size}` };
}

/** 外周ヒントを置く grid の位置（1始まり）。 */
export function getReflectionClueGridPosition(
  size: number,
  { side, index }: ReflectionEntry,
): { row: number; column: number } {
  const last = size + 4;
  switch (side) {
    case "top":
      return { row: 1, column: index + 3 };
    case "right":
      return { row: index + 3, column: last };
    case "bottom":
      return { row: last, column: index + 3 };
    case "left":
      return { row: index + 3, column: 1 };
  }
}

/** 盤面の外へ向かう向き。 */
export function getReflectionOutwardVector(side: ReflectionSide): {
  dx: number;
  dy: number;
} {
  switch (side) {
    case "top":
      return { dx: 0, dy: -1 };
    case "right":
      return { dx: 1, dy: 0 };
    case "bottom":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
  }
}

function getCellCenter(size: number, cellIndex: number): ReflectionPoint {
  const { row, column } = getReflectionCellPosition(size, cellIndex);
  return { x: BOARD_OFFSET + column + 0.5, y: BOARD_OFFSET + row + 0.5 };
}

/** 外周ヒントの盤面側の縁の中点。光路はここから入り、ここへ出る。 */
export function getReflectionClueAnchor(
  size: number,
  { side, index }: ReflectionEntry,
): ReflectionPoint {
  const along = BOARD_OFFSET + index + 0.5;
  switch (side) {
    case "top":
      return { x: along, y: CLUE_TRACK };
    case "right":
      return { x: BOARD_OFFSET * 2 + size - CLUE_TRACK, y: along };
    case "bottom":
      return { x: along, y: BOARD_OFFSET * 2 + size - CLUE_TRACK };
    case "left":
      return { x: CLUE_TRACK, y: along };
  }
}

/** 外周ヒントの中心。 */
export function getReflectionClueCenter(
  size: number,
  entry: ReflectionEntry,
): ReflectionPoint {
  const anchor = getReflectionClueAnchor(size, entry);
  const { dx, dy } = getReflectionOutwardVector(entry.side);
  return {
    x: anchor.x + (dx * CLUE_TRACK) / 2,
    y: anchor.y + (dy * CLUE_TRACK) / 2,
  };
}

/** 盤面の左上の角の位置。 */
export function getReflectionBoardOrigin(): ReflectionPoint {
  return { x: BOARD_OFFSET, y: BOARD_OFFSET };
}

/** 光路の折れ線。入った外周・曲がる／はね返るマスの中心・出た外周（吸収ならそのマスの中心）を結ぶ。 */
export function getReflectionLaserPoints(
  size: number,
  entry: ReflectionEntry,
  trace: ReflectionLaserTrace,
): ReflectionPoint[] {
  const turns = trace.path
    .filter((step) => step.leaving !== step.entering)
    .map((step) => getCellCenter(size, step.cellIndex));
  const end = trace.exit ? [getReflectionClueAnchor(size, trace.exit)] : [];
  return [getReflectionClueAnchor(size, entry), ...turns, ...end];
}

export type ReflectionTracedEntry = {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

/**
 * 全外周からの光路。別の位置へ出る光路は両端から同じ線になるので、先に並ぶ端からの1本だけを残す。
 */
export function listDistinctReflectionLaserTraces(
  board: ReflectionBoard,
): ReflectionTracedEntry[] {
  const traced = listReflectionEntries(board.size).map((entry) => ({
    entry,
    trace: traceReflectionLaser(board, entry),
  }));
  return traced.filter(function isFirstEnd({ trace }, index) {
    const { exit } = trace;
    if (trace.outcome !== "exit" || exit === null) return true;
    const exitIndex = traced.findIndex(({ entry }) =>
      isSameReflectionEntry(entry, exit),
    );
    return index < exitIndex;
  });
}
