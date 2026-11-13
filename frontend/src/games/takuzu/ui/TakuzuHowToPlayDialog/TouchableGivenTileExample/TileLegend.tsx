import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";

const legendItems = [
  { given: true, label: "最初から" },
  { given: false, label: "置いた" },
] as const;

/** 最初からあるタイルと置いたタイルの色の凡例。例の図と同じ色の四角を頭に置く。 */
export function TileLegend() {
  return (
    <span className="flex items-center gap-4">
      {legendItems.map(({ given, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span aria-hidden="true" className="size-4">
            <TakuzuCellFace cell="a" given={given} size="figure" />
          </span>
          {label}
        </span>
      ))}
    </span>
  );
}
