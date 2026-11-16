import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamState,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { parkingJamBoardGeometry } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import type {
  ParkingJamExampleHint,
  ParkingJamExampleMoveMark,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import type { ParkingJamHowToPlayGesture } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { getParkingJamFigureBoxStyle } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-size";
import { BoardHint } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard/BoardHint";
import { MoveMark } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard/MoveMark";

type HowToPlayBoardProps = {
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  /** 渡すと、本番の盤面と同じく車と矢印を押せる。渡さない盤面（ゴールの盤面）は押せない。 */
  onSelectVehicle?: (vehicleId: ParkingJamVehicleId) => void;
  onMove?: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
  marks?: readonly ParkingJamExampleMoveMark[];
  hint?: ParkingJamExampleHint | null;
  /** 手がかりで示す、例が見せる手の打ち方。 */
  gesture?: ParkingJamHowToPlayGesture;
  /** 最後の車を本番のクリアの動きで出すとき `true`。動きを終えた後も `true` のままにすると、最後の車を道路の外に置いたままにする。 */
  clearing?: boolean;
  onClearAnimationComplete?: () => void;
};

function ignoreBoardOperation() {}

/**
 * 本番の盤面部品で描く、遊び方の盤面。描く範囲は遊び方の図の余白（`figure`）にし、大きさはマスの大きさ
 * （`--parking-jam-figure-cell`）の倍数にして、どの図でも車を同じ大きさに見せる。
 * 印と手がかりは盤面の上に重ね、押す操作は下の盤面へ通す。
 */
export function HowToPlayBoard({
  board,
  state,
  selectedVehicleId,
  operation,
  onSelectVehicle,
  onMove,
  marks = [],
  hint = null,
  gesture = "swipe",
  clearing = false,
  onClearAnimationComplete = ignoreBoardOperation,
}: HowToPlayBoardProps) {
  const viewBox = parkingJamBoardGeometry.getViewBox(board, "figure");
  const interactive = onSelectVehicle !== undefined && onMove !== undefined;
  return (
    <div
      className="relative shrink-0"
      style={getParkingJamFigureBoxStyle(board)}
    >
      <ParkingJamBoard
        board={board}
        state={state}
        selectedVehicleId={selectedVehicleId}
        operation={operation}
        interactionDisabled={!interactive}
        clearing={clearing}
        onSelectVehicle={onSelectVehicle ?? ignoreBoardOperation}
        onMove={onMove ?? ignoreBoardOperation}
        onClearAnimationComplete={onClearAnimationComplete}
        frame="figure"
        // 遊び方は送る画面なので、指でスクロールを止めるのは、スワイプが始まる車と矢印の上だけにする。
        touchLock="vehicles"
      />
      {/* 共通の手がかりの大きさは、盤面のマスを単位にして決める。 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [--how-to-play-unit:var(--parking-jam-figure-cell)]"
      >
        {marks.map((mark) => {
          const vehicle = board.vehicles.find(
            ({ id }) => id === mark.vehicleId,
          );
          return vehicle ? (
            <MoveMark
              key={`${mark.vehicleId}:${mark.direction}`}
              viewBox={viewBox}
              vehicle={vehicle}
              mark={mark}
            />
          ) : null;
        })}
        {hint === null ? null : (
          <BoardHint
            board={board}
            viewBox={viewBox}
            hint={hint}
            gesture={gesture}
          />
        )}
      </span>
    </div>
  );
}
