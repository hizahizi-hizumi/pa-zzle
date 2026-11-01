import type {
  ParkingJamBoard,
  ParkingJamDirection,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import type { ParkingJamExitContact } from "@/games/parking-jam/puzzle/rules";
import type { ParkingJamContactCue } from "@/games/parking-jam/ui/board/board-cue";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

/** 車体・植え込みは、マスの縁からこの幅だけ内側に描く（`ParkingJamCar`・`ParkingJamLot` と同じ値）。 */
const BODY_INSET = 10;
/** 外周の縁石の半分の太さ（`parking-jam-board.css` の縁石の線幅の半分）。 */
const CURB_HALF_WIDTH = 7;

type Point = { x: number; y: number };

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<ParkingJamDirection, Point>;

/** 車体の、進む向きの先端の中央。 */
function getVehicleFront(
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): Point {
  const horizontal = vehicle.orientation === "horizontal";
  const left = vehicle.column * PARKING_JAM_CELL;
  const top = vehicle.row * PARKING_JAM_CELL;
  const right = left + (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL;
  const bottom = top + (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  switch (direction) {
    case "up":
      return { x: centerX, y: top + BODY_INSET };
    case "right":
      return { x: right - BODY_INSET, y: centerY };
    case "down":
      return { x: centerX, y: bottom - BODY_INSET };
    case "left":
      return { x: left + BODY_INSET, y: centerY };
  }
}

/** 車体の先端から、示すもの（外周では縁石の内側）の表面までの距離。 */
function getContactDistance(contact: ParkingJamExitContact): number {
  const free = contact.freeCellCount * PARKING_JAM_CELL;
  return contact.blocker.kind === "wall"
    ? free + BODY_INSET - CURB_HALF_WIDTH
    : free + BODY_INSET * 2;
}

function BlockerShape({
  board,
  vehicle,
  direction,
  contact,
  front,
}: {
  board: ParkingJamBoard;
  vehicle: ParkingJamVehicle;
  direction: ParkingJamDirection;
  contact: ParkingJamExitContact;
  front: Point;
}) {
  const { blocker } = contact;
  if (blocker.kind === "vehicle") {
    const other = board.vehicles.find(({ id }) => id === blocker.vehicleId);
    if (!other) {
      return null;
    }
    const horizontal = other.orientation === "horizontal";
    return (
      <rect
        x={other.column * PARKING_JAM_CELL + 4}
        y={other.row * PARKING_JAM_CELL + 4}
        width={(horizontal ? other.length : 1) * PARKING_JAM_CELL - 8}
        height={(horizontal ? 1 : other.length) * PARKING_JAM_CELL - 8}
        rx="24"
        className="parking-jam-contact__blocker"
      />
    );
  }
  if (blocker.kind === "fixed-area") {
    return (
      <rect
        x={blocker.cell.column * PARKING_JAM_CELL + 4}
        y={blocker.cell.row * PARKING_JAM_CELL + 4}
        width={PARKING_JAM_CELL - 8}
        height={PARKING_JAM_CELL - 8}
        rx="12"
        className="parking-jam-contact__blocker"
      />
    );
  }
  // 道路につながっていない外周。その車線の幅だけ、縁石の上に重ねる。
  const distance = getContactDistance(contact) + CURB_HALF_WIDTH;
  const vector = directionVectors[direction];
  const end = {
    x: front.x + vector.x * distance,
    y: front.y + vector.y * distance,
  };
  const half = PARKING_JAM_CELL / 2 - 14;
  const across = vehicle.orientation === "horizontal";
  return (
    <line
      x1={across ? end.x : end.x - half}
      y1={across ? end.y - half : end.y}
      x2={across ? end.x : end.x + half}
      y2={across ? end.y + half : end.y}
      className="parking-jam-contact__wall"
    />
  );
}

/**
 * 出られない手で、車がまっすぐ進む先を線で、最初に当たるものを縁取りで示す。
 * 道路につながっていない外周に当たるときは、その車線の縁石を示す。
 */
export function ParkingJamContactMark({
  board,
  cue,
}: {
  board: ParkingJamBoard;
  cue: ParkingJamContactCue;
}) {
  const vehicle = board.vehicles.find(({ id }) => id === cue.move.vehicleId);
  if (!vehicle) {
    return null;
  }
  const { direction } = cue.move;
  const front = getVehicleFront(vehicle, direction);
  const distance = getContactDistance(cue.contact);
  const vector = directionVectors[direction];
  return (
    <g
      aria-hidden="true"
      data-contact-cue={cue.tone}
      data-vehicle-id={vehicle.id}
      data-blocker={cue.contact.blocker.kind}
      className={`parking-jam-contact parking-jam-contact--${cue.tone}`}
    >
      {distance > 0 && (
        <line
          x1={front.x}
          y1={front.y}
          x2={front.x + vector.x * distance}
          y2={front.y + vector.y * distance}
          className="parking-jam-contact__path"
        />
      )}
      <BlockerShape
        board={board}
        vehicle={vehicle}
        direction={direction}
        contact={cue.contact}
        front={front}
      />
    </g>
  );
}
