import { createContext, type ReactNode, useContext, useId } from "react";
import {
  createTsumeShogiRealPieceDefIds,
  RealPieceDefs,
  type TsumeShogiRealPieceDefIds,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs/RealPieceDefs";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";

/**
 * 駒の塗りの id。駒ごとに `<defs>` を持たず、盤・持駒・図でまとめて1組を参照する。
 * 玉方の駒は頂点を下にして描くので、画面の上から光が当たって見えるよう、上下を逆にした塗りも持つ。
 */
export type TsumeShogiPieceDefIds = {
  /** 面取りした縁。上の縁が光を受けて明るく、下の縁が陰になる。 */
  bevel: string;
  defenderBevel: string;
  /** 縁の内側の平らな面。 */
  face: string;
  defenderFace: string;
  /** 面に淡く重ねる、縦に通る柾目。 */
  grain: string;
  /** 案R の駒の塗りと字形（`TsumeShogiPieceDefs/RealPieceDefs.tsx`）。 */
  real: TsumeShogiRealPieceDefIds;
};

const TsumeShogiPieceDefsContext = createContext<TsumeShogiPieceDefIds | null>(
  null,
);

/** 内側の駒が参照する塗りの id。`TsumeShogiPieceDefs` の外では `null`。 */
export function useTsumeShogiPieceDefIds(): TsumeShogiPieceDefIds | null {
  return useContext(TsumeShogiPieceDefsContext);
}

/** 柾目の細い筋。幅 100・高さ 112 の模様で、間隔と太さを不揃いにして木の目に見せる。 */
const faintGrain =
  "M0.5 0h0.8v112h-0.8zM5.1 0h0.5v112h-0.5zM10.6 0h0.5v112h-0.5zM19.3 0h0.5v112h-0.5zM23.9 0h1v112h-1zM41.5 0h0.5v112h-0.5zM44.1 0h1.3v112h-1.3zM47.9 0h1v112h-1zM57.2 0h1.3v112h-1.3zM66.6 0h0.6v112h-0.6zM69.2 0h1.3v112h-1.3zM88 0h1v112h-1zM91.8 0h0.6v112h-0.6zM98.6 0h0.6v112h-0.6z";
const strongGrain =
  "M16.1 0h0.5v112h-0.5zM27.1 0h0.5v112h-0.5zM31.7 0h0.5v112h-0.5zM34.3 0h0.6v112h-0.6zM36.9 0h1.3v112h-1.3zM53.4 0h0.5v112h-0.5zM59.8 0h1.3v112h-1.3zM74.7 0h0.5v112h-0.5zM77.9 0h1v112h-1zM82.5 0h0.8v112h-0.8z";
/** 柾目の模様を駒の座標（0.1mm）へ広げる。模様の幅 100 を約 28mm（玉の底辺の幅）にし、中心をそろえる。 */
const grainTransform = "translate(-140 0) scale(2.8 3)";

type TsumeShogiPieceDefsProps = {
  children: ReactNode;
};

/**
 * 駒の塗りを1組だけ置き、内側の駒から参照させる。盤の81升に駒が並んでも、グラデーションと模様は1組で済む。
 */
export function TsumeShogiPieceDefs({ children }: TsumeShogiPieceDefsProps) {
  const id = useId();
  const ids = {
    bevel: `${id}bevel`,
    defenderBevel: `${id}defender-bevel`,
    face: `${id}face`,
    defenderFace: `${id}defender-face`,
    grain: `${id}grain`,
    real: createTsumeShogiRealPieceDefIds(id),
  } satisfies TsumeShogiPieceDefIds;

  return (
    <TsumeShogiPieceDefsContext value={ids}>
      {/* 塗りを参照できるよう、描画はするが大きさを持たない svg に置く（display: none では参照できない端末がある）。 */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute size-0 overflow-hidden"
      >
        <defs>
          <linearGradient id={ids.bevel} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              className={tsumeShogiToneClassNames.pieceBevelLight}
            />
            <stop
              offset="1"
              className={tsumeShogiToneClassNames.pieceBevelDark}
            />
          </linearGradient>
          <linearGradient
            id={ids.defenderBevel}
            href={`#${ids.bevel}`}
            x1="0"
            y1="1"
            x2="0"
            y2="0"
          />
          <linearGradient id={ids.face} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              className={tsumeShogiToneClassNames.pieceFaceTop}
            />
            <stop
              offset="1"
              className={tsumeShogiToneClassNames.pieceFaceBottom}
            />
          </linearGradient>
          <linearGradient
            id={ids.defenderFace}
            href={`#${ids.face}`}
            x1="0"
            y1="1"
            x2="0"
            y2="0"
          />
          <pattern
            id={ids.grain}
            width="100"
            height="112"
            patternUnits="userSpaceOnUse"
            patternTransform={grainTransform}
          >
            <path
              d={faintGrain}
              opacity={0.05}
              className={tsumeShogiToneClassNames.pieceGrain}
            />
            <path
              d={strongGrain}
              opacity={0.1}
              className={tsumeShogiToneClassNames.pieceGrain}
            />
          </pattern>
          <RealPieceDefs ids={ids.real} />
        </defs>
      </svg>
      {children}
    </TsumeShogiPieceDefsContext>
  );
}
