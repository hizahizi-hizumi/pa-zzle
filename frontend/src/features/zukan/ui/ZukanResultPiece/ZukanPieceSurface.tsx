import type { SVGProps } from "react";
import {
  listZukanPieceLayers,
  type ZukanPieceLayer,
} from "@/features/zukan/ui/zukan-piece-material";

type ZukanPieceSurfaceProps = {
  /** ピースの輪郭。マスの左上を原点、1辺を 1 とする座標。 */
  path: string;
  /** `ZukanPieceMaterialDefs` に置いた、この輪郭の切り抜きの ID。 */
  clipId: string;
  /** `ZukanPieceMaterialDefs` に置いた、面の階調の ID。 */
  lightId: string;
};

function paintLayer(
  layer: ZukanPieceLayer,
  lightId: string,
): SVGProps<SVGPathElement> {
  switch (layer.kind) {
    case "face":
      return { fill: "currentColor" };
    case "light":
      return { fill: `url(#${lightId})` };
    case "bevel-light":
      return { fill: "#fff", fillOpacity: layer.opacity, fillRule: "evenodd" };
    case "bevel-shade":
      return { fill: "#000", fillOpacity: layer.opacity, fillRule: "evenodd" };
  }
}

/** 台紙から出した、評価の色（`currentColor`）の面に、光の階調と縁の面取りを付けたピース。SVG の中に置く。 */
export function ZukanPieceSurface({
  path,
  clipId,
  lightId,
}: ZukanPieceSurfaceProps) {
  return (
    <g clipPath={`url(#${clipId})`}>
      {listZukanPieceLayers(path).map((layer) => (
        <path key={layer.kind} d={layer.d} {...paintLayer(layer, lightId)} />
      ))}
    </g>
  );
}
