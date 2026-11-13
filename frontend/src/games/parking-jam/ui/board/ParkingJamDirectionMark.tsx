import type {
  ParkingJamDirection,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

type ParkingJamDirectionHitArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ParkingJamDirectionControl = {
  direction: ParkingJamDirection;
  cx: number;
  cy: number;
  path: string;
  hitArea: ParkingJamDirectionHitArea;
};

// 最も広い 8 マスの盤面を幅 375px の画面に収めると 1 マスが約 36px になる。
// そのときにも押せる範囲を 44px 四方以上にするため、盤面の単位で 124 を確保する。
const HIT_AREA_SIZE = 124;
/** 押せる範囲は、車の半分から、矢印の指す向きへ車の外まで広げる。 */
const HIT_AREA_OUTSIDE = HIT_AREA_SIZE - PARKING_JAM_CELL + 10;

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
  const half = (horizontal ? width : height) / 2;
  const alongSize = half + HIT_AREA_OUTSIDE;

  if (horizontal) {
    const cy = y + height / 2;
    const left = x + inset;
    const right = x + width - inset;
    const crossY = cy - HIT_AREA_SIZE / 2;
    return [
      {
        direction: "left",
        cx: left,
        cy,
        path: `M ${left + arrowHalf} ${cy - arrowHalf} L ${left - 4} ${cy} L ${left + arrowHalf} ${cy + arrowHalf}`,
        hitArea: {
          x: x - HIT_AREA_OUTSIDE,
          y: crossY,
          width: alongSize,
          height: HIT_AREA_SIZE,
        },
      },
      {
        direction: "right",
        cx: right,
        cy,
        path: `M ${right - arrowHalf} ${cy - arrowHalf} L ${right + 4} ${cy} L ${right - arrowHalf} ${cy + arrowHalf}`,
        hitArea: {
          x: x + half,
          y: crossY,
          width: alongSize,
          height: HIT_AREA_SIZE,
        },
      },
    ];
  }

  const cx = x + width / 2;
  const up = y + inset;
  const down = y + height - inset;
  const crossX = cx - HIT_AREA_SIZE / 2;
  return [
    {
      direction: "up",
      cx,
      cy: up,
      path: `M ${cx - arrowHalf} ${up + arrowHalf} L ${cx} ${up - 4} L ${cx + arrowHalf} ${up + arrowHalf}`,
      hitArea: {
        x: crossX,
        y: y - HIT_AREA_OUTSIDE,
        width: HIT_AREA_SIZE,
        height: alongSize,
      },
    },
    {
      direction: "down",
      cx,
      cy: down,
      path: `M ${cx - arrowHalf} ${down - arrowHalf} L ${cx} ${down + 4} L ${cx + arrowHalf} ${down - arrowHalf}`,
      hitArea: {
        x: crossX,
        y: y + half,
        width: HIT_AREA_SIZE,
        height: alongSize,
      },
    },
  ];
}

type ParkingJamDirectionMarkProps = {
  control: ParkingJamDirectionControl;
};

/** 押せる範囲は描かない。 */
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
