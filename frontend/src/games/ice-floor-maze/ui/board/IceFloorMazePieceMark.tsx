import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** 石の上の面。真円にせず少し横長にして、滑っている間の回転が見えるようにする。 */
const STONE = { rx: 0.33, ry: 0.29 } as const;
/** 右下の氷へ落とす影。岩場より低いので、短い。 */
const STONE_SHADOW = 0.06;

/**
 * 親が駒のいるマスの中心へ置く。
 * 氷の上を滑って、何かに当たるまで止まらない、磨いた平らな石。取っ手や印は付けず、左上に小さな光を1つだけ入れる。
 * 盤面と同じく真上から見た絵にし、手前の側面は描かない。縁の暗い輪と影は回さず、上の面（`data-piece-spin`）だけを回して、
 * 滑っている間の回転を描ける。
 */
export function IceFloorMazePieceMark() {
  const palette = iceFloorMazeTone;

  return (
    <>
      <circle
        cx={STONE_SHADOW}
        cy={STONE_SHADOW}
        r={STONE.rx}
        fill={palette.shadow}
      />
      <circle r={STONE.rx} fill={palette.pieceShade} />
      <g
        data-piece-spin=""
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <ellipse rx={STONE.rx} ry={STONE.ry} fill={palette.piece} />
        <path
          d="M-0.2 -0.06A0.22 0.2 0 0 1 -0.05 -0.18"
          fill="none"
          stroke={palette.pieceLight}
          strokeWidth={0.045}
          strokeLinecap="round"
        />
      </g>
    </>
  );
}
