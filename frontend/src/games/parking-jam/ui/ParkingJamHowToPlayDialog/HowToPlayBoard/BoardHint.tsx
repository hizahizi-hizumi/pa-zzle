import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import type {
  ParkingJamBoard,
  ParkingJamDirection,
} from "@/games/parking-jam/puzzle/board";
import {
  type ParkingJamViewBox,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import type { ParkingJamExampleHint } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import type { ParkingJamHowToPlayGesture } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import {
  getDirectionControl,
  placeAt,
  placeRect,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard/figure-placement";

type BoardHintProps = {
  board: ParkingJamBoard;
  viewBox: ParkingJamViewBox;
  hint: ParkingJamExampleHint;
  gesture: ParkingJamHowToPlayGesture;
};

const swipeArrows = {
  up: ArrowUp,
  right: ArrowRight,
  down: ArrowDown,
  left: ArrowLeft,
} as const satisfies Record<ParkingJamDirection, LucideIcon>;

/** 本番の矢印の丸の半径。手がかりは、この丸を押す物として囲む。 */
const DIRECTION_CONTROL_RADIUS = 21;

/**
 * 押す所の手がかり。押す物（車体か本番の矢印の丸）の箱を盤面の上に置き、共通の手がかりをその箱いっぱいに重ねる。
 * 盤面は暗い舗装なので、手がかりはテーマによらず暗い地の色で描く。
 * - 車に付けるとき: 車体の外を角の丸い枠で囲み、指先を車の真ん中に当てる。スワイプで見せる例では、出す向きの矢印を、
 *   車を押すと本番の矢印が出る所（車体の内側の端）に添える。車の端の外の札には重ねない。
 * - 矢印に付けるとき: 本番の矢印の丸を丸い枠で囲み、指は丸の右下の角に半分外へ出して、矢印の向きを隠さない。
 */
export function BoardHint({ board, viewBox, hint, gesture }: BoardHintProps) {
  const vehicle = board.vehicles.find(({ id }) => id === hint.vehicleId);
  const control = vehicle && getDirectionControl(vehicle, hint.direction);
  if (!vehicle || !control) {
    return null;
  }
  if (hint.target === "arrow") {
    return (
      <span
        data-testid="board-hint"
        data-hint-target="arrow"
        data-hinted-vehicle={vehicle.id}
        className="absolute"
        style={placeRect(
          viewBox,
          { x: control.cx, y: control.cy, width: 0, height: 0 },
          DIRECTION_CONTROL_RADIUS,
        )}
      >
        <HowToPlayPressHint
          frame="outside"
          outline="round"
          pointer="outside-corner"
          ground="dark"
        />
      </span>
    );
  }
  const SwipeArrow = swipeArrows[hint.direction];
  return (
    <>
      <span
        data-testid="board-hint"
        data-hint-target="vehicle"
        data-hinted-vehicle={vehicle.id}
        data-swipe-direction={gesture === "swipe" ? hint.direction : undefined}
        className="absolute"
        style={placeRect(
          viewBox,
          parkingJamBoardGeometry.getVehicleBody(vehicle),
          0,
        )}
      >
        <HowToPlayPressHint
          frame="outside"
          outline="rounded"
          pointer="fingertip-on-center"
          ground="dark"
        />
      </span>
      {gesture === "swipe" ? (
        <span
          aria-hidden="true"
          className="absolute flex size-[max(16px,calc(var(--parking-jam-figure-cell)*0.32))] -translate-1/2 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]"
          style={placeAt(viewBox, control.cx, control.cy)}
        >
          <SwipeArrow className="size-full" strokeWidth={3} />
        </span>
      ) : null}
    </>
  );
}
