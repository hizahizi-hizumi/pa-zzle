import { Check, type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 触れる例の判定。
 * - `allowed`: できる（✓）。
 * - `disallowed`: できない（✕）。
 * - `incomplete`: 形のルールで、埋め切るまで決まらない途中の姿。印を付けず淡い色で「途中」と言う。
 */
type HowToPlayVerdictState = "allowed" | "disallowed" | "incomplete";

/** できる・できないを言う言葉。形のルールでは「できる / できない」、手のルールでは手の動詞で言う。 */
export type HowToPlayVerdictLabels = { allowed: string; disallowed: string };

type HowToPlayVerdictProps = {
  verdict: HowToPlayVerdictState;
  labels: HowToPlayVerdictLabels;
  /** ✕ の言葉と、添えるわけの色。本番の盤面に違反の印があるゲームは、その印と同じ色を渡す。渡さなければ文字の色のまま。 */
  disallowedClassName?: string;
  /** ✕ のとき、例が教えるルールとは別のわけ。判定の下の2行目に、場所を取らずに重ねて添える。 */
  reason?: string;
  /** 判定の右に添える物（行の数など）。判定と1つのまとまりにする。 */
  aside?: ReactNode;
};

type VerdictLook = { Icon: LucideIcon | null; className: string };

const verdictStates = ["allowed", "disallowed", "incomplete"] as const;

const incompleteLabel = "途中";

/**
 * 触れる例の今の姿の判定（✓ / ✕ と言葉、または途中）。
 * 判定の言葉はどれも同じ場所に重ねて短く入れ替え、場所はいちばん長い言葉の幅で取るので、入れ替えても周りは動かない。
 * 右に添える物があるときは、判定と添える物を1つのまとまりにし、まとまりごと例の盤面の中央に置く。
 * 判定の言葉は添える物の側に寄せ、添える物との間をどの言葉でも同じにする。
 * 添える物が無いときは、記号と言葉の組を場所の中央、つまり盤面の中央に置く。
 * 例が教えるルールとは別のわけで弾かれたときは、なぜできないかが分かるよう、わけを判定の下に添える。
 * 添える言葉は行の高さを取らずに判定の下に重ね、判定と周りを動かさない。例を並べる面が、その高さの分の間を例の下に取る。
 * 動きを減らす設定ではすぐ入れ替える。
 */
export function HowToPlayVerdict({
  verdict,
  labels,
  disallowedClassName = "text-foreground",
  reason,
  aside,
}: HowToPlayVerdictProps) {
  const looks = {
    allowed: { Icon: Check, className: "text-foreground" },
    disallowed: { Icon: X, className: disallowedClassName },
    incomplete: { Icon: null, className: "text-muted-foreground" },
  } as const satisfies Record<HowToPlayVerdictState, VerdictLook>;
  const words = { ...labels, incomplete: incompleteLabel };
  return (
    <span className="relative flex items-center gap-3">
      {/* どの言葉の箱も場所いっぱいに広げて同じ矩形にし、中身をその中で寄せる。 */}
      <span className="grid">
        {verdictStates.map((shown) => {
          const { Icon, className } = looks[shown];
          return (
            <span
              key={shown}
              aria-hidden={shown !== verdict}
              className={cn(
                "col-start-1 row-start-1 flex items-center gap-1 whitespace-nowrap transition-opacity duration-(--duration-fast) ease-standard motion-reduce:transition-none",
                aside === undefined ? "justify-center" : "justify-end",
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
      {aside}
      {verdict === "disallowed" && reason !== undefined ? (
        <span
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap",
            disallowedClassName,
          )}
        >
          <span className="sr-only">・</span>
          {reason}
        </span>
      ) : null}
    </span>
  );
}
