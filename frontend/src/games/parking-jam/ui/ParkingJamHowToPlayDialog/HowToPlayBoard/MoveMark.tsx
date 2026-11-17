import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import type {
  ParkingJamDirection,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import type { ParkingJamViewBox } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import type { ParkingJamExampleMoveMark } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import {
  getVehicleEndPoint,
  placeAt,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard/figure-placement";

type MoveMarkProps = {
  viewBox: ParkingJamViewBox;
  vehicle: ParkingJamVehicle;
  mark: ParkingJamExampleMoveMark;
};

/**
 * 札を、車体の端から出す向きへ押し出す並べ方。札の内側の縁を車体の端から、共通の手がかりの破線の枠
 * （車体の外 `max(4px, マス×0.08)`）より 2px 外に置き、車体・車体の内側の端に出る本番の矢印とスワイプの向きの矢印・
 * 手がかりの枠のどれにも重ねない。札の大きさに下限（16px）があるので、盤面の座標ではなく画面の上の長さでずらす。
 */
const MARK_GAP = "calc(max(4px, var(--parking-jam-figure-cell) * 0.08) + 2px)";

const markTransforms = {
  up: `translate(-50%, calc(-100% - ${MARK_GAP}))`,
  right: `translate(${MARK_GAP}, -50%)`,
  down: `translate(-50%, ${MARK_GAP})`,
  left: `translate(calc(-100% - ${MARK_GAP}), -50%)`,
} as const satisfies Record<ParkingJamDirection, string>;

/**
 * 車の端に付ける、その向きへ出られるかの札。車体の端の外側（出す向きの側）に置き、どの向きの答えかを位置で示す。
 * 車体の外に置くので、車を押して本番の矢印が出ている間も札を残す。
 * 本番の矢印（暗い丸に白い向き）と見分けられるよう、判定と同じ ✓ / ✕ を地の色の丸い札で描く。札の大きさはマスの大きさに比べて決める。
 */
export function MoveMark({ viewBox, vehicle, mark }: MoveMarkProps) {
  const point = getVehicleEndPoint(vehicle, mark.direction);
  return (
    <span
      data-testid="move-mark"
      data-move-mark={`${mark.vehicleId}:${mark.direction}`}
      data-allowed={mark.allowed}
      className="absolute flex size-[max(16px,calc(var(--parking-jam-figure-cell)*0.36))]"
      style={{
        ...placeAt(viewBox, point.x, point.y),
        transform: markTransforms[mark.direction],
      }}
    >
      <HowToPlayVerdictMark
        verdict={mark.allowed ? "allowed" : "disallowed"}
        placement="board-tag"
      />
    </span>
  );
}
