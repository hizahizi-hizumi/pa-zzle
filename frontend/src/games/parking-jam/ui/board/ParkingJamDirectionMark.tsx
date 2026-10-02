import type {
  ParkingJamDirection,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

export type ParkingJamDirectionControl = {
  direction: ParkingJamDirection;
  cx: number;
  cy: number;
  path: string;
};

/** 選んだ車の両端に出す、出庫方向の矢印の位置と形。 */
export function getParkingJamDirectionControls(
  vehicle: ParkingJamVehicle,
): ParkingJamDirectionControl[] {
  const horizontal = vehicle.orientation === "horizontal";
  const width = (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - 20;
  const height = (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - 20;
  const x = vehicle.column * PARKING_JAM_CELL + 10;
  const y = vehicle.row * PARKING_JAM_CELL + 10;
  const inset = 27;
  const arrowHalf = 8;

  if (horizontal) {
    const cy = y + height / 2;
    const left = x + inset;
    const right = x + width - inset;
    return [
      {
        direction: "left",
        cx: left,
        cy,
        path: `M ${left + arrowHalf} ${cy - arrowHalf} L ${left - 4} ${cy} L ${left + arrowHalf} ${cy + arrowHalf}`,
      },
      {
        direction: "right",
        cx: right,
        cy,
        path: `M ${right - arrowHalf} ${cy - arrowHalf} L ${right + 4} ${cy} L ${right - arrowHalf} ${cy + arrowHalf}`,
      },
    ];
  }

  const cx = x + width / 2;
  const up = y + inset;
  const down = y + height - inset;
  return [
    {
      direction: "up",
      cx,
      cy: up,
      path: `M ${cx - arrowHalf} ${up + arrowHalf} L ${cx} ${up - 4} L ${cx + arrowHalf} ${up + arrowHalf}`,
    },
    {
      direction: "down",
      cx,
      cy: down,
      path: `M ${cx - arrowHalf} ${down - arrowHalf} L ${cx} ${down + 4} L ${cx + arrowHalf} ${down - arrowHalf}`,
    },
  ];
}

type ParkingJamDirectionMarkProps = {
  control: ParkingJamDirectionControl;
};

/** 出庫方向の矢印の見た目。押せる範囲は描かない。 */
export function ParkingJamDirectionMark({
  control,
}: ParkingJamDirectionMarkProps) {
  return (
    <>
      <circle
        cx={control.cx}
        cy={control.cy}
        r="21"
        className="parking-jam-direction-control__surface"
      />
      <path d={control.path} className="parking-jam-direction-control__arrow" />
    </>
  );
}
