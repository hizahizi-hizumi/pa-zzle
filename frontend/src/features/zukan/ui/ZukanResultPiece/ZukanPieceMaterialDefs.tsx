import {
  getZukanPieceLightAxis,
  ZUKAN_PIECE_LIGHT_STOPS,
} from "@/features/zukan/ui/zukan-piece-material";

type ZukanPieceMaterialDefsProps = {
  lightId: string;
  clips: readonly { id: string; path: string }[];
};

/** ピースの質感が参照する、面の階調と、ピースの輪郭の切り抜き。SVG の中に置く。 */
export function ZukanPieceMaterialDefs({
  lightId,
  clips,
}: ZukanPieceMaterialDefsProps) {
  const { from, to } = getZukanPieceLightAxis();
  return (
    <defs>
      <linearGradient
        id={lightId}
        gradientUnits="userSpaceOnUse"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      >
        {ZUKAN_PIECE_LIGHT_STOPS.map(({ offset, color, opacity }) => (
          <stop
            key={`${offset}${color}`}
            offset={offset}
            stopColor={color}
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      {clips.map(({ id, path }) => (
        <clipPath key={id} id={id}>
          <path d={path} />
        </clipPath>
      ))}
    </defs>
  );
}
