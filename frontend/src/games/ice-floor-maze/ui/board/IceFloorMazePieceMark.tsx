import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { IceFloorMazePenguinMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePenguinMark";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

const PIECE_RADIUS = 0.32;
const PIECE_RIM_WIDTH = 0.08;

type IceFloorMazePieceMarkProps = {
  look?: IceFloorMazeLook;
  direction?: IceFloorMazeDirection;
};

/** 氷上を滑る駒。比較案では氷面に映る縁と反射を追加する。 */
export function IceFloorMazePieceMark({
  look = "current",
  direction = "up",
}: IceFloorMazePieceMarkProps) {
  return (
    <g>
      {look === "penguin" ? (
        <IceFloorMazePenguinMark direction={direction} />
      ) : null}
      {look !== "current" && look !== "penguin" ? (
        <>
          <path
            data-piece-shadow=""
            d="M -.07 -.33 L .25 -.22 L .38 .08 L .2 .35 L -.13 .4 L -.38 .16 L -.36 -.14 Z"
          />
          <path
            data-piece-shell=""
            d="M 0 -.41 L .3 -.245 L .39 .035 L .245 .315 L -.08 .37 L -.365 .16 L -.355 -.14 Z"
            strokeWidth="0.04"
            strokeLinejoin="round"
          />
          <path
            data-piece-light=""
            d="M 0 -.38 L .3 -.245 L .065 .02 L -.25 -.12 Z"
          />
          <path
            data-piece-facet=""
            d="M -.25 -.12 L .065 .02 L .245 .315 L -.08 .37 L -.365 .16 Z"
          />
          <path
            data-piece-core=""
            d="M 0 -.275 L .19 -.16 L .255 .065 L .125 .22 L -.115 .225 L -.245 .045 L -.21 -.14 Z"
          />
          <path
            data-piece-reflection=""
            d="M -.245 -.14 L -.14 -.28 M -.065 -.325 L .125 -.255"
            strokeWidth=".038"
            strokeLinecap="round"
            fill="none"
          />
          <circle data-piece-glint="" cx="-.095" cy="-.15" r=".044" />
        </>
      ) : look === "current" ? (
        <circle
          data-piece-mark=""
          r={PIECE_RADIUS}
          strokeWidth={PIECE_RIM_WIDTH}
          className={iceFloorMazeToneClassNames.piece}
        />
      ) : null}
    </g>
  );
}
