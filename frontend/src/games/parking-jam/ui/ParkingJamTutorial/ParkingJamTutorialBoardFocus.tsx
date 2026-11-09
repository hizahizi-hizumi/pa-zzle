import type { CSSProperties, ReactNode } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type {
  ParkingJamBoard,
  ParkingJamCell,
  ParkingJamMove,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

/**
 * 盤面の上で示す物。
 * - `vehicle`: 車。
 * - `fixed-area`: そのマスを含む植え込み。
 * - `curb`: その手の車線で、道路につながっていない外周の縁石。
 */
export type ParkingJamTutorialFocusTarget =
  | { kind: "vehicle"; vehicleId: ParkingJamVehicleId }
  | { kind: "fixed-area"; cell: ParkingJamCell }
  | { kind: "curb"; move: ParkingJamMove };

/** 次に動かす車の印。`recallId` は印の無い車を触られるたびに変え、印の線を短く濃くして戻す。 */
export type ParkingJamTutorialMark = {
  vehicleId: ParkingJamVehicleId;
  recallId: number | null;
};

type ParkingJamTutorialBoardFocusProps = {
  board: ParkingJamBoard;
  /** 手を引いている間、画面全体の覆いから抜いて元の明るさで見せる物。 */
  spotlights: readonly ParkingJamTutorialFocusTarget[];
  mark: ParkingJamTutorialMark | null;
  /** 盤面。この枠いっぱいに描く。 */
  children: ReactNode;
};

/** 盤面の座標で表した、物の外形の角丸の四角。 */
type Shape = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

/** 車体は、マスの縁からこの幅だけ内側に、この角丸で描く（`ParkingJamCar` の車体と同じ値）。 */
const VEHICLE_BODY_INSET = 10;
const VEHICLE_BODY_RADIUS = 20;
/** 植え込みは、マスの縁からこの幅だけ内側に、この角丸で描く（`ParkingJamLot` の植え込みと同じ値）。 */
const ISLAND_INSET = 10;
const ISLAND_RADIUS = 8;
/** 外周の縁石の半分の太さ。縁石は端の丸い線なので、角丸もこの値になる（`parking-jam-board.css` の縁石の線幅の半分）。 */
const CURB_HALF_WIDTH = 7;

function getViewBoxSize(board: ParkingJamBoard) {
  return {
    width: board.width * PARKING_JAM_CELL + PARKING_JAM_MARGIN * 2,
    height: board.height * PARKING_JAM_CELL + PARKING_JAM_MARGIN * 2,
  };
}

function getVehicleShape(
  board: ParkingJamBoard,
  vehicleId: ParkingJamVehicleId,
): Shape | null {
  const vehicle = board.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) {
    return null;
  }
  const horizontal = vehicle.orientation === "horizontal";
  return {
    x: vehicle.column * PARKING_JAM_CELL + VEHICLE_BODY_INSET,
    y: vehicle.row * PARKING_JAM_CELL + VEHICLE_BODY_INSET,
    width:
      (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL -
      VEHICLE_BODY_INSET * 2,
    height:
      (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL -
      VEHICLE_BODY_INSET * 2,
    radius: VEHICLE_BODY_RADIUS,
  };
}

function getFixedAreaShape(
  board: ParkingJamBoard,
  cell: ParkingJamCell,
): Shape | null {
  const area = board.fixedAreas.find(
    ({ row, column, width, height }) =>
      cell.row >= row &&
      cell.row < row + height &&
      cell.column >= column &&
      cell.column < column + width,
  );
  return area
    ? {
        x: area.column * PARKING_JAM_CELL + ISLAND_INSET,
        y: area.row * PARKING_JAM_CELL + ISLAND_INSET,
        width: area.width * PARKING_JAM_CELL - ISLAND_INSET * 2,
        height: area.height * PARKING_JAM_CELL - ISLAND_INSET * 2,
        radius: ISLAND_RADIUS,
      }
    : null;
}

/** 手の車線が外周に当たる所を通る縁石。縁石は道路の口の間ごとに1本の線なので、その1本の形にする。 */
function getCurbShape(
  board: ParkingJamBoard,
  { vehicleId, direction }: ParkingJamMove,
): Shape | null {
  const vehicle = board.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) {
    return null;
  }
  const across = direction === "left" || direction === "right";
  const laneCenter =
    ((across ? vehicle.row : vehicle.column) + 0.5) * PARKING_JAM_CELL;
  const edge = {
    left: 0,
    right: board.width * PARKING_JAM_CELL,
    up: 0,
    down: board.height * PARKING_JAM_CELL,
  }[direction];
  const curb = parkingJamBoardGeometry
    .getBoundaryCurbLines(board)
    .find(({ x1, y1, x2, y2 }) =>
      across
        ? x1 === edge &&
          x2 === edge &&
          Math.min(y1, y2) <= laneCenter &&
          laneCenter <= Math.max(y1, y2)
        : y1 === edge &&
          y2 === edge &&
          Math.min(x1, x2) <= laneCenter &&
          laneCenter <= Math.max(x1, x2),
    );
  if (!curb) {
    return null;
  }
  const left = Math.min(curb.x1, curb.x2) - CURB_HALF_WIDTH;
  const top = Math.min(curb.y1, curb.y2) - CURB_HALF_WIDTH;
  return {
    x: left,
    y: top,
    width: Math.max(curb.x1, curb.x2) + CURB_HALF_WIDTH - left,
    height: Math.max(curb.y1, curb.y2) + CURB_HALF_WIDTH - top,
    radius: CURB_HALF_WIDTH,
  };
}

function getTargetShape(
  board: ParkingJamBoard,
  target: ParkingJamTutorialFocusTarget,
): Shape | null {
  switch (target.kind) {
    case "vehicle":
      return getVehicleShape(board, target.vehicleId);
    case "fixed-area":
      return getFixedAreaShape(board, target.cell);
    case "curb":
      return getCurbShape(board, target.move);
  }
}

/** 示す物の名前。車は車の ID、植え込みはマス、縁石は当たる手の向き。 */
function getTargetName(target: ParkingJamTutorialFocusTarget): string {
  switch (target.kind) {
    case "vehicle":
      return `vehicle-${target.vehicleId}`;
    case "fixed-area":
      return `fixed-area-${target.cell.row}-${target.cell.column}`;
    case "curb":
      return `curb-${target.move.direction}`;
  }
}

/**
 * 抜く所を外形ごとに1つにする。決め手と、出られなかった手で当たったものが同じ物を指すことがあり、
 * 同じ形を重ねて抜くと覆いの中で同じ穴が2つになる。
 */
function listSpotlightPlacements(
  board: ParkingJamBoard,
  targets: readonly ParkingJamTutorialFocusTarget[],
): { key: string; name: string; shape: Shape }[] {
  const placements = new Map<
    string,
    { key: string; name: string; shape: Shape }
  >();
  for (const target of targets) {
    const shape = getTargetShape(board, target);
    const key = shape && [shape.x, shape.y, shape.width, shape.height].join();
    if (shape && key && !placements.has(key)) {
      placements.set(key, { key, name: getTargetName(target), shape });
    }
  }
  return [...placements.values()];
}

/**
 * 物の外形を、盤面と同じ大きさの枠に対する割合で置く。
 * 角丸は盤面の幅に比例させ、覆いが読む値を描いた大きさの角丸と揃える。
 */
function getPlacementStyle(
  board: ParkingJamBoard,
  { x, y, width, height, radius }: Shape,
): CSSProperties {
  const viewBox = getViewBoxSize(board);
  return {
    left: `${((x + PARKING_JAM_MARGIN) / viewBox.width) * 100}%`,
    top: `${((y + PARKING_JAM_MARGIN) / viewBox.height) * 100}%`,
    width: `${(width / viewBox.width) * 100}%`,
    height: `${(height / viewBox.height) * 100}%`,
    borderRadius: `${(radius / viewBox.width) * 100}cqw`,
  };
}

/**
 * チュートリアルの盤面を、盤面と同じ縦横比の枠に収め、その上に覆いから抜く所と印を盤面の物と同じ位置・形で重ねる。
 * 盤面は SVG で描くので、覆いが位置と角丸を読めるよう、抜く所と印は盤面の上に重ねた HTML の要素に置く。
 * 車は車体の形、植え込みは植え込みの形、縁石は端の丸い線の形のまま抜き、覆いのための余白や角丸は足さない。
 */
export function ParkingJamTutorialBoardFocus({
  board,
  spotlights,
  mark,
  children,
}: ParkingJamTutorialBoardFocusProps) {
  const viewBox = getViewBoxSize(board);
  const markShape = mark && getVehicleShape(board, mark.vehicleId);
  return (
    <div
      className="relative"
      style={{
        aspectRatio: `${viewBox.width} / ${viewBox.height}`,
        // 盤面の SVG の幅の上限（`parking-jam-board.css` の 48rem）と揃え、縦横どちらにも収まる大きさにする。
        width: `min(100cqw, 100cqh * ${viewBox.width / viewBox.height}, 48rem)`,
      }}
    >
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [container-type:inline-size]"
      >
        {listSpotlightPlacements(board, spotlights).map(
          ({ key, name, shape }) => (
            <span
              key={key}
              data-spotlight-target={name}
              className="absolute"
              style={getPlacementStyle(board, shape)}
            >
              <TutorialSpotlight active className="inset-0 rounded-[inherit]" />
            </span>
          ),
        )}
        {mark && markShape && (
          <span
            data-vehicle-mark={mark.vehicleId}
            className="absolute"
            style={getPlacementStyle(board, markShape)}
          >
            <TutorialCue kind="mark" recallId={mark.recallId} />
          </span>
        )}
      </div>
    </div>
  );
}
