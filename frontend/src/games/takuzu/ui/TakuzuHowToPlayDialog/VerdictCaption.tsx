import { Check, type LucideIcon, X } from "lucide-react";

import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { lineViolationTextClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import type {
  TakuzuExampleLineTileCounts,
  TakuzuExampleVerdict,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import { RowDifferenceBar } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/RowDifferenceBar";
import { cn } from "@/lib/utils";

/** できる・できないを言う言葉。形のルールでは「できる / できない」、手のルールでは手の動詞で言う。 */
export type VerdictLabels = { allowed: string; disallowed: string };

type VerdictCaptionProps = {
  /** 出す判定。 */
  verdict: TakuzuExampleVerdict;
  labels?: VerdictLabels;
  /** できない形のとき、例が教えるルールとは別に破ったルール。判定の下の2行目に、場所を取らずに重ねて添える。 */
  reason?: string;
  /** 行の四角と丸の数を添えるときの、数と、違反の印と同じ色で示す超えた方のタイル。 */
  tileCounts?: TakuzuExampleLineTileCounts;
  /**
   * 見比べる所の短い線の凡例（線と「違う所」）を、判定の右に添えるか。
   * `reserved` は、盤面に線が無い間も凡例の場所を取って隠し、線が出入りしても判定のまとまりを動かさない。
   */
  differenceLegend?: "shown" | "reserved";
};

const shapeLabels: VerdictLabels = {
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

type VerdictLook = { Icon: LucideIcon | null; className: string };

/** ✓ は文字の色、✕ は盤面の違反の印と同じ色、途中は印を付けず淡い色にする。 */
const verdictLooks = {
  allowed: { Icon: Check, className: "text-foreground" },
  disallowed: { Icon: X, className: lineViolationTextClassName },
  incomplete: { Icon: null, className: "text-muted-foreground" },
} as const satisfies Record<TakuzuExampleVerdict, VerdictLook>;

const verdicts = ["allowed", "disallowed", "incomplete"] as const;

/**
 * 例の今の姿の判定。
 * 判定の言葉はどれも同じ場所に重ねて短く入れ替え、場所はいちばん長い言葉の幅で取るので、入れ替えても周りは動かない。
 * 数や凡例を添えるときは、判定とそれらを1つのまとまりにし、まとまりごと例の盤面の中央に置く。判定の言葉は数や凡例の側に寄せ、
 * その間をどの言葉でも同じにする。数と凡例は判定が替わっても出し入れしないので、まとまりは動かない。
 * 数を添えないときは、記号と言葉の組を場所の中央、つまり盤面の中央に置く。
 * 例が教えるルールとは別のルールを破ったときは、なぜできないかが分かるよう、破ったルールを判定の下に添える。
 * 添える言葉は行の高さを取らずに判定の下に重ね、判定と周りを動かさない。例を並べる面が、その高さの分の間を例の下に取る。
 * 動きを減らす設定ではすぐ入れ替える。
 */
export function VerdictCaption({
  verdict,
  labels = shapeLabels,
  reason,
  tileCounts,
  differenceLegend,
}: VerdictCaptionProps) {
  const words = { ...labels, incomplete: "途中" };
  const hasAside = tileCounts !== undefined || differenceLegend !== undefined;
  return (
    <span className="relative flex items-center gap-3">
      {/* どの言葉の箱も場所いっぱいに広げて同じ矩形にし、中身をその中で寄せる。 */}
      <span className="grid">
        {verdicts.map((shown) => {
          const { Icon, className } = verdictLooks[shown];
          return (
            <span
              key={shown}
              aria-hidden={shown !== verdict}
              className={cn(
                "col-start-1 row-start-1 flex items-center gap-1 whitespace-nowrap transition-opacity duration-(--duration-fast) ease-standard motion-reduce:transition-none",
                hasAside ? "justify-end" : "justify-center",
                className,
                shown === verdict ? "opacity-100" : "opacity-0",
              )}
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  className="size-4 shrink-0"
                  strokeWidth={2.5}
                />
              ) : null}
              {words[shown]}
            </span>
          );
        })}
      </span>
      {tileCounts ? (
        <span
          aria-hidden="true"
          className="flex items-center gap-2 whitespace-nowrap tabular-nums"
        >
          {(["a", "b"] as const).map((tile) => (
            <span key={tile}>
              <span
                className={cn("me-1 inline-block", tileSymbolClassNames[tile])}
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
      ) : null}
      {differenceLegend !== undefined ? (
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
      ) : null}
      {verdict === "disallowed" && reason !== undefined ? (
        <span
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap",
            lineViolationTextClassName,
          )}
        >
          <span className="sr-only">・</span>
          {reason}
        </span>
      ) : null}
    </span>
  );
}
