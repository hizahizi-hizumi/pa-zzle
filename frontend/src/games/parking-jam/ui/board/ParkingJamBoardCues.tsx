import type { CSSProperties } from "react";

import type {
  ParkingJamBoard,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import type {
  ParkingJamContactCue,
  ParkingJamVehicleCue,
} from "@/games/parking-jam/ui/board/board-cue";
import { ParkingJamContactMark } from "@/games/parking-jam/ui/board/ParkingJamContactMark";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

type ParkingJamBoardCuesProps = {
  board: ParkingJamBoard;
  remainingVehicleIds: readonly ParkingJamVehicleId[];
  cues: readonly ParkingJamVehicleCue[];
  contacts: readonly ParkingJamContactCue[];
  ghostVehicleIds: readonly ParkingJamVehicleId[];
  ghostDelayMs: number;
};

const cueLayers = {
  hint: 0,
  rejected: 1,
} as const satisfies Record<ParkingJamVehicleCue["kind"], number>;

/** 車体の外側を囲む枠。 */
function getVehicleFrame(vehicle: ParkingJamVehicle, inset: number) {
  const horizontal = vehicle.orientation === "horizontal";
  return {
    x: vehicle.column * PARKING_JAM_CELL + inset,
    y: vehicle.row * PARKING_JAM_CELL + inset,
    width: (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - inset * 2,
    height: (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - inset * 2,
  };
}

/** 車体の外側に重ねる合図の枠。次に動かす車の印は、付け直すたびに中を一瞬光らせる。 */
function ParkingJamVehicleCueMark({
  vehicle,
  cue,
}: {
  vehicle: ParkingJamVehicle;
  cue: ParkingJamVehicleCue;
}) {
  const frame = getVehicleFrame(vehicle, 4);
  return (
    <g
      data-vehicle-cue={cue.kind}
      data-vehicle-id={vehicle.id}
      aria-hidden="true"
    >
      {cue.kind === "hint" && (
        <rect {...frame} rx="24" className="parking-jam-car-cue__flash" />
      )}
      <rect
        {...frame}
        rx="24"
        className={`parking-jam-car-cue parking-jam-car-cue--${cue.kind}`}
      />
    </g>
  );
}

/**
 * 盤面の上に重ねる合図。車を動かすたびに作り直す車の要素とは分けて描き、印の光が手のたびにやり直されないようにする。
 * 停まっていた場所の点線を一番下に、当たるものの合図、印、警告の縁の順に重ねる。
 */
export function ParkingJamBoardCues({
  board,
  remainingVehicleIds,
  cues,
  contacts,
  ghostVehicleIds,
  ghostDelayMs,
}: ParkingJamBoardCuesProps) {
  const ghostStyle = { animationDelay: `${ghostDelayMs}ms` } as CSSProperties;
  return (
    <>
      {board.vehicles
        .filter(
          ({ id }) =>
            ghostVehicleIds.includes(id) && !remainingVehicleIds.includes(id),
        )
        .map((vehicle) => (
          <rect
            key={`ghost-${vehicle.id}`}
            {...getVehicleFrame(vehicle, 12)}
            rx="18"
            aria-hidden="true"
            data-vehicle-ghost={vehicle.id}
            className="parking-jam-car-ghost"
            style={ghostStyle}
          />
        ))}
      {contacts.map((cue) => (
        <ParkingJamContactMark
          key={`contact-${cue.move.vehicleId}-${cue.move.direction}-${cue.tone}-${cue.id}`}
          board={board}
          cue={cue}
        />
      ))}
      {[...cues]
        .sort((left, right) => cueLayers[left.kind] - cueLayers[right.kind])
        .map((cue) => {
          const vehicle = board.vehicles.find(
            (candidate) => candidate.id === cue.vehicleId,
          );
          return vehicle && remainingVehicleIds.includes(vehicle.id) ? (
            <ParkingJamVehicleCueMark
              key={`${cue.vehicleId}-${cue.kind}-${cue.id}`}
              vehicle={vehicle}
              cue={cue}
            />
          ) : null;
        })}
    </>
  );
}
