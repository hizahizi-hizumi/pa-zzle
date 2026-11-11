import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { hasKineticMotion } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

const PIECE_RADIUS = 0.32;
const PIECE_RIM_WIDTH = 0.08;

type IceFloorMazePieceMarkProps = { look?: IceFloorMazeLook };

/** 通常は抽象的な駒を維持し、滑走案だけ氷上の薄い円盤として質量を与える。 */
export function IceFloorMazePieceMark({
  look = "current",
}: IceFloorMazePieceMarkProps) {
  return hasKineticMotion(look) ? (
    <g data-glide-puck="">
      <ellipse data-puck-shadow="" cy=".08" rx=".32" ry=".30" />
      <ellipse data-puck-base="" cy=".045" rx=".335" ry=".32" />
      <circle data-puck-face="" cy="-.035" r=".315" />
      <path
        data-puck-sheen=""
        d="M-.23 -.12 A .28 .28 0 0 1 .22 -.19"
        strokeWidth=".042"
        strokeLinecap="round"
        fill="none"
      />
      <circle data-puck-glint="" cx="-.14" cy="-.185" r=".042" />
    </g>
  ) : (
    <circle
      data-piece-mark=""
      r={PIECE_RADIUS}
      strokeWidth={PIECE_RIM_WIDTH}
      className={iceFloorMazeToneClassNames.piece}
    />
  );
}
