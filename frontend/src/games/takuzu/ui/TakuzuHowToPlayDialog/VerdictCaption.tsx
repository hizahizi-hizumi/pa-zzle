import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { lineViolationTextClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import type {
  TakuzuExampleLineTileCounts,
  TakuzuExampleVerdict,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import { RowDifferenceBar } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/RowDifferenceBar";
import { cn } from "@/lib/utils";

type VerdictCaptionProps = {
  /** 出す判定。 */
  verdict: TakuzuExampleVerdict;
  labels?: HowToPlayVerdictLabels;
  /** できない形のとき、例が教えるルールとは別に破ったルール。判定の下の2行目に、場所を取らずに重ねて添える。 */
  reason?: string;
  /** 行の四角と丸の数を添えるときの、数と、違反の印と同じ色で示す超えた方のタイル。 */
  tileCounts?: TakuzuExampleLineTileCounts;
  /**
   * 見比べる所の短い線の凡例（線と「違う所」）を、判定の右に添えるか。
   * `reserved` は、盤面に線が無い間も凡例の場所を取って隠し、線が出入りしても判定を動かさない。
   */
  differenceLegend?: "shown" | "reserved";
};

const shapeLabels: HowToPlayVerdictLabels = {
  allowed: "できる",
  disallowed: "できない",
};

/**
 * 数に添える記号の大きさと縦の位置。数字の字の高さ（`cap`）で決め、記号の中央を数字の縦の中央にそろえる。
 * 記号の箱はタイルの余白を含むので、箱の下端を、箱の高さの半分から字の高さの半分を引いた分だけ、ベースラインより下げる。
 * 丸は線だけで四角より軽く小さく見えるので、四角より一回り大きくして、見た目の大きさをそろえる。
 */
const tileSymbolClassNames = {
  a: "size-[1.33cap] align-[-0.165cap]",
  b: "size-[1.48cap] align-[-0.24cap]",
} as const satisfies Record<TakuzuTile, string>;

/** 見比べる所の短い線の凡例（線と「違う所」）。 */
function renderDifferenceLegend(differenceLegend: "shown" | "reserved") {
  return (
    // マスの読み上げ名が「もう1行と違う」を伝えるので、凡例は読み上げない。
    <span
      aria-hidden="true"
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap",
        differenceLegend === "reserved" && "invisible",
      )}
    >
      <RowDifferenceBar placement="legend" />
      違う所
    </span>
  );
}

/**
 * 例の今の姿の判定。共通の判定（`HowToPlayVerdict`）で出し、✕ と添えるわけは盤面の違反の印と同じ色にする。
 * 数を添えるときは、判定を例の盤面の中央に置き、数をその右に置く。数は判定が替わっても出し入れしないので、判定は動かない。
 * 見比べる所の凡例を添えるときは、判定を盤面の中央に置き、凡例をその右に置く。判定の左には凡例と同じ幅を空けるので、
 * 凡例を隠している間も、判定は ✓ / ✕ / 途中 のどれでも盤面の中央にそろう。
 * 数も凡例も添えないときは、記号と言葉の組を盤面の中央に置く。
 * 例が教えるルールとは別のルールを破ったときは、なぜできないかが分かるよう、破ったルールを判定の下に重ねて添える。
 */
export function VerdictCaption({
  verdict,
  labels = shapeLabels,
  reason,
  tileCounts,
  differenceLegend,
}: VerdictCaptionProps) {
  const shownVerdict = (
    <HowToPlayVerdict
      verdict={verdict}
      labels={labels}
      disallowedClassName={lineViolationTextClassName}
      reason={reason}
      aside={
        tileCounts ? (
          <span
            aria-hidden="true"
            className="flex items-center gap-2 whitespace-nowrap tabular-nums"
          >
            {(["a", "b"] as const).map((tile) => (
              <span key={tile}>
                <span
                  className={cn(
                    "me-1 inline-block",
                    tileSymbolClassNames[tile],
                  )}
                >
                  <TakuzuCellFace cell={tile} given={false} size="figure" />
                </span>
                <span
                  className={
                    tile === tileCounts.overfilledTile
                      ? lineViolationTextClassName
                      : "text-foreground"
                  }
                >
                  {tileCounts.counts[tile]}
                </span>
              </span>
            ))}
          </span>
        ) : undefined
      }
    />
  );
  if (differenceLegend === undefined) {
    return shownVerdict;
  }
  return (
    // 左右の列は同じ幅（凡例の幅）になり、真ん中の判定が盤面の中央に来る。
    <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <span aria-hidden="true" />
      {shownVerdict}
      <span data-how-to-play-verdict-aside className="flex justify-start">
        {renderDifferenceLegend(differenceLegend)}
      </span>
    </span>
  );
}
