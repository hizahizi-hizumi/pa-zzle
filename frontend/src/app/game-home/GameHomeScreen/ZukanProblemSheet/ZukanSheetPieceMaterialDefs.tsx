import {
  getZukanPieceLightAxis,
  getZukanSheetPieceFaceId,
  listZukanSheetPieceFaceStops,
  listZukanSheetPieceGrooveStops,
  ZUKAN_SHEET_PIECE_GROOVE_ID,
  type ZukanPieceGradientStop,
} from "@/features/zukan/ui/zukan-piece-material";
import { gameResultLevelsAscending } from "@/games/result";

/** 台紙に嵌まったピースが参照する、評価ごとの面の階調と、溝の線の階調。SVG の中に置く。 */
export function ZukanSheetPieceMaterialDefs() {
  const { from, to } = getZukanPieceLightAxis();
  function drawGradient(id: string, stops: readonly ZukanPieceGradientStop[]) {
    return (
      <linearGradient
        key={id}
        id={id}
        gradientUnits="userSpaceOnUse"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      >
        {stops.map(({ offset, color }) => (
          // 色に CSS の変数を使うので、属性ではなく style で与える。
          <stop key={offset} offset={offset} style={{ stopColor: color }} />
        ))}
      </linearGradient>
    );
  }
  return (
    <defs>
      {gameResultLevelsAscending.map((level) =>
        drawGradient(
          getZukanSheetPieceFaceId(level),
          listZukanSheetPieceFaceStops(`var(--grade-${level})`),
        ),
      )}
      {drawGradient(
        ZUKAN_SHEET_PIECE_GROOVE_ID,
        listZukanSheetPieceGrooveStops("var(--background)"),
      )}
    </defs>
  );
}
