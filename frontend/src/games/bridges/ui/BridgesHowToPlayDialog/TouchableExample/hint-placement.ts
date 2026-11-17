import type {
  HowToPlayPressHintCorner,
  HowToPlayPressHintGesture,
  HowToPlayPressHintOutline,
  HowToPlayPressHintPointer,
} from "@/components/HowToPlayPressHint";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import type { BridgesHowToPlayHint } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import {
  type BoardPoint,
  type BoardRect,
  type BoardView,
  getEdgeViewSegment,
  getIslandViewRect,
} from "@/games/bridges/ui/board/board-geometry";

/**
 * 押す所の手がかりを重ねる箱（絵の座標）と、共通の手がかりの部品に渡す置き方。
 * `fingertip` は、指先を箱の中央に置く手（`fingertip-on-center`）での指先の所。本番の盤面でここを押すと、例が見せる手になる。
 */
export type BridgesHintPlacement = {
  rect: BoardRect;
  outline: HowToPlayPressHintOutline;
  pointer: HowToPlayPressHintPointer;
  corner?: HowToPlayPressHintCorner;
  gesture: HowToPlayPressHintGesture;
  fingertip: BoardPoint | null;
};

/** 島の間を押す手の箱の太さ（マス幅に対する比）。2本の橋の板より太くし、押す所が線の上の帯だと分かるようにする。 */
const EDGE_BOX_THICKNESS = 0.66;
/** 島の間を押す手の箱の、線に沿った長さ。 */
const EDGE_BOX_LENGTH = 1;
/** 島を囲む箱を、島の陸からどれだけ外へ広げるか。 */
const ISLAND_BOX_OUTSET = 0.1;
/** 交差する所を囲む箱の一辺。 */
const CROSSING_BOX_SIDE = 0.7;

function getCenter({ x, y, width, height }: BoardRect): BoardPoint {
  return { x: x + width / 2, y: y + height / 2 };
}

function getRectAround(center: BoardPoint, width: number, height: number) {
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

function getIslandBox(view: BoardView, island: number): BoardRect {
  const { x, y, width, height } = getIslandViewRect(view, island);
  return {
    x: x - ISLAND_BOX_OUTSET,
    y: y - ISLAND_BOX_OUTSET,
    width: width + ISLAND_BOX_OUTSET * 2,
    height: height + ISLAND_BOX_OUTSET * 2,
  };
}

/**
 * 島の間を押す手の箱。線の終わりの島（右か下の島）から1マス手前を中央にした、線に沿った1マスの帯にする。
 * 隣り合う2マスの間の線なら島と島の間いっぱいになり、長い線では、途中でほかの線と交差する所（どちらの線か決まらない所）を避けられる。
 */
function getEdgeBox(view: BoardView, edge: number): BoardRect {
  const { start, end } = getEdgeViewSegment(view, edge);
  const horizontal = start.y === end.y;
  const center = {
    x: end.x - Math.sign(end.x - start.x),
    y: end.y - Math.sign(end.y - start.y),
  };
  return horizontal
    ? getRectAround(center, EDGE_BOX_LENGTH, EDGE_BOX_THICKNESS)
    : getRectAround(center, EDGE_BOX_THICKNESS, EDGE_BOX_LENGTH);
}

/** なぞる手は、なぞり始める島から相手の島までを1つの箱で囲み、指をなぞり始める島の側の角の内側に置く。 */
function getDragPlacement(
  view: BoardView,
  edge: number,
  island: number,
): BridgesHintPlacement {
  const { from, to } = getBridgesNetwork(view.board).edges[edge]!;
  const start = getIslandBox(view, from);
  const end = getIslandBox(view, to);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const rect = {
    x,
    y,
    width: Math.max(start.x + start.width, end.x + end.width) - x,
    height: Math.max(start.y + start.height, end.y + end.height) - y,
  };
  const horizontal = start.y === end.y;
  const fromStart = island === from;
  const corner: HowToPlayPressHintCorner = horizontal
    ? fromStart
      ? "bottom-left"
      : "bottom-right"
    : fromStart
      ? "top-right"
      : "bottom-right";
  return {
    rect,
    outline: "round",
    pointer: "inside-corner",
    corner,
    gesture: "press",
    fingertip: null,
  };
}

/** 例が見せる手の、押す所の手がかりの置き方。 */
export function getBridgesHintPlacement(
  view: BoardView,
  hint: BridgesHowToPlayHint,
): BridgesHintPlacement {
  switch (hint.kind) {
    case "edge": {
      const rect = getEdgeBox(view, hint.edge);
      return {
        rect,
        outline: "rounded",
        pointer: "fingertip-on-center",
        gesture: "press",
        fingertip: getCenter(rect),
      };
    }
    case "backward":
      return {
        rect: getEdgeBox(view, hint.edge),
        outline: "rounded",
        pointer: "center",
        gesture: "secondary-press",
        fingertip: null,
      };
    case "drag":
      return getDragPlacement(view, hint.edge, hint.island);
    case "select":
    case "pair": {
      const rect = getIslandBox(view, hint.island);
      return {
        rect,
        outline: "round",
        pointer: "fingertip-on-center",
        gesture: "press",
        fingertip: getCenter(rect),
      };
    }
    case "crossing": {
      const [first, second] = hint.edges.map((edge) =>
        getEdgeViewSegment(view, edge),
      );
      const vertical = first!.start.x === first!.end.x ? first! : second!;
      const horizontal = vertical === first ? second! : first!;
      const point = { x: vertical.start.x, y: horizontal.start.y };
      return {
        rect: getRectAround(point, CROSSING_BOX_SIDE, CROSSING_BOX_SIDE),
        outline: "round",
        pointer: "fingertip-on-center",
        gesture: "press",
        fingertip: point,
      };
    }
  }
}
