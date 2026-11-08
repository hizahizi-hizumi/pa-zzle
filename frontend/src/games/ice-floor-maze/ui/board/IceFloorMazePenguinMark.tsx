/** 進む向きを向いたペンギン。氷原案だけの主人公で、地形のルールには関与しない。 */
type IceFloorMazePenguinMarkProps = {
  direction: "up" | "right" | "down" | "left";
};

const rotationByDirection = { up: 0, right: 90, down: 180, left: -90 } as const;

export function IceFloorMazePenguinMark({
  direction,
}: IceFloorMazePenguinMarkProps) {
  return (
    <g data-penguin="" transform={`rotate(${rotationByDirection[direction]})`}>
      <ellipse
        cx=".035"
        cy=".095"
        rx=".36"
        ry=".4"
        fill="#1b627b"
        opacity=".25"
      />
      <g
        data-penguin-left-wing=""
        style={{ transformBox: "fill-box", transformOrigin: "right center" }}
      >
        <path
          d="M-.23 -.17 Q-.38 -.22 -.43 .02 Q-.46 .21 -.28 .24 L-.13 .05Z"
          fill="#294e63"
          stroke="#a2e2e8"
          strokeWidth=".022"
        />
      </g>
      <g
        data-penguin-right-wing=""
        style={{ transformBox: "fill-box", transformOrigin: "left center" }}
      >
        <path
          d="M.23 -.17 Q.38 -.22 .43 .02 Q.46 .21 .28 .24 L.13 .05Z"
          fill="#294e63"
          stroke="#a2e2e8"
          strokeWidth=".022"
        />
      </g>
      <path
        d="M-.20 .22 L-.27 .37 L-.12 .33 L-.045 .25ZM.20 .22 L.27 .37 L.12 .33 L.045 .25Z"
        fill="#efa74a"
        stroke="#b97b36"
        strokeWidth=".016"
      />
      <path
        d="M0 -.4 C .25 -.4 .315 -.19 .32 .09 C .32 .36 .19 .4 0 .4 C-.19 .4 -.32 .36 -.32 .09 C-.315 -.19 -.25 -.4 0 -.4Z"
        fill="#254458"
        stroke="#b7edf0"
        strokeWidth=".036"
      />
      <path
        d="M0 -.15 C .20 -.16 .24 .025 .245 .16 C.25 .34 .12 .34 0 .35 C-.12 .34 -.25 .34 -.245 .16 C-.24 .025 -.20 -.16 0 -.15Z"
        fill="#f4faf5"
      />
      <path
        d="M-.20 -.25 Q-.17 -.39 0 -.37 Q.17 -.39 .20 -.25 Q.17 -.08 0 -.09 Q-.17 -.08 -.20 -.25Z"
        fill="#f3fafa"
      />
      <ellipse cx="-.09" cy="-.27" rx=".042" ry=".063" fill="#142f41" />
      <ellipse cx=".09" cy="-.27" rx=".042" ry=".063" fill="#142f41" />
      <circle cx="-.103" cy="-.295" r=".014" fill="#fff" />
      <circle cx=".076" cy="-.295" r=".014" fill="#fff" />
      <path
        d="M-.075 -.155 L0 -.08 L.075 -.155 Q0 -.2 -.075 -.155Z"
        fill="#f0a749"
        stroke="#be7e39"
        strokeWidth=".014"
      />
      <path
        d="M-.18 .03 Q-.11 -.02 -.045 0"
        stroke="#fff"
        strokeWidth=".03"
        fill="none"
        opacity=".8"
        strokeLinecap="round"
      />
    </g>
  );
}
