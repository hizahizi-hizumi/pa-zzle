import type { CSSProperties } from "react";

import type {
  ParkingJamDirection,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import {
  getParkingJamDirectionControls,
  type ParkingJamDirectionControl,
} from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";
import {
  type ParkingJamRectGeometry,
  type ParkingJamViewBox,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

/** 盤面の座標の点を、描く範囲の左上からの割合で置く。 */
export function placeAt(
  viewBox: ParkingJamViewBox,
  x: number,
  y: number,
): CSSProperties {
  return {
    left: `${((x - viewBox.x) / viewBox.width) * 100}%`,
    top: `${((y - viewBox.y) / viewBox.height) * 100}%`,
  };
}

/** 盤面の座標の矩形を、外へ `outset` だけ広げて、描く範囲に対する割合で置く。 */
export function placeRect(
  viewBox: ParkingJamViewBox,
  rect: ParkingJamRectGeometry,
  outset: number,
): CSSProperties {
  return {
    ...placeAt(viewBox, rect.x - outset, rect.y - outset),
    width: `${((rect.width + outset * 2) / viewBox.width) * 100}%`,
    height: `${((rect.height + outset * 2) / viewBox.height) * 100}%`,
  };
}

/** 車体の `direction` の側の端の真ん中。 */
export function getVehicleEndPoint(
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): { x: number; y: number } {
  const body = parkingJamBoardGeometry.getVehicleBody(vehicle);
  const centerX = body.x + body.width / 2;
  const centerY = body.y + body.height / 2;
  switch (direction) {
    case "up":
      return { x: centerX, y: body.y };
    case "down":
      return { x: centerX, y: body.y + body.height };
    case "left":
      return { x: body.x, y: centerY };
    case "right":
      return { x: body.x + body.width, y: centerY };
  }
}

/** 本番で車を押したときに、その向きの矢印が出る所。 */
export function getDirectionControl(
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): ParkingJamDirectionControl | undefined {
  return getParkingJamDirectionControls(vehicle).find(
    (control) => control.direction === direction,
  );
}
