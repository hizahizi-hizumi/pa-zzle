import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

const PIECE_RADIUS = 0.32;
const PIECE_RIM_WIDTH = 0.08;

/** 駒。白い縁取りの円で、親が駒のいるマスの中心へ置く。 */
export function IceFloorMazePieceMark() {
  return (
    <circle
      r={PIECE_RADIUS}
      strokeWidth={PIECE_RIM_WIDTH}
      className={iceFloorMazeToneClassNames.piece}
    />
  );
}
