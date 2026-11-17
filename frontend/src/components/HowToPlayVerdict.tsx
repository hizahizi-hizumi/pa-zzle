import { Check, type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";

import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
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
  /** 判定の右に添える物（行の数など）。判定を盤面の中央に置いたまま、右の列に置く。 */
  aside?: ReactNode;
};

type VerdictLook = { Icon: LucideIcon | null; className: string };

const verdictStates = ["allowed", "disallowed", "incomplete"] as const;

const incompleteLabel = "途中";

/**
 * 触れる例の今の姿の判定（✓ / ✕ と言葉、または途中）。記号と言葉の1行は `HowToPlayVerdictLine` で描く。
 * 判定の言葉はどれも同じ場所に重ね、場所はいちばん長い言葉の幅で取るので、入れ替えても周りは動かない。
 * 入れ替えはすぐに行い、古い言葉と新しい言葉を重ねて見せない。
 * 右に添える物があるときも、判定の言葉を例の盤面の中央に置き、添える物はその右に並べる。
 * 添える物が無いときは、記号と言葉の組を場所の中央、つまり盤面の中央に置く。
 * 例が教えるルールとは別のわけで弾かれたときは、なぜできないかが分かるよう、わけを判定の下に添える。
 * わけは行の高さを取らずに判定の下に重ね、判定と周りを動かさない。例を並べる面が、その高さの分の間を例の下に取る。
 * わけもまとまりの中央に置き、長いわけが片側へ伸びないようにする。
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
  const shownReason =
    verdict === "disallowed" && reason !== undefined ? reason : undefined;
  return (
    <span
      data-how-to-play-verdict
      className={cn(
        "relative items-center gap-3",
        // 添える物があるときは、同じ幅の左右の列の真ん中に判定を置き、判定を盤面の中央に保ったまま右の列に添える物を置く。
        aside === undefined ? "flex" : "grid grid-cols-[1fr_auto_1fr]",
      )}
    >
      {aside === undefined ? null : <span aria-hidden="true" />}
      {/* どの言葉の箱も場所いっぱいに広げて同じ矩形にし、中身をその中で寄せる。 */}
      <span className="grid">
        {verdictStates.map((shown) => {
          const { Icon, className } = looks[shown];
          return (
            <span
              key={shown}
              aria-hidden={shown !== verdict}
              className={cn(
                "col-start-1 row-start-1 flex",
                className,
                shown === verdict ? null : "invisible",
              )}
            >
              <HowToPlayVerdictLine
                mark={
                  Icon ? (
                    <Icon className="size-4 shrink-0" strokeWidth={2.5} />
                  ) : undefined
                }
                align="center"
              >
                {words[shown]}
              </HowToPlayVerdictLine>
            </span>
          );
        })}
      </span>
      {aside === undefined ? null : (
        <span data-how-to-play-verdict-aside className="flex justify-start">
          {aside}
        </span>
      )}
      {shownReason !== undefined ? (
        <span
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap",
            disallowedClassName,
          )}
        >
          <span className="sr-only">・</span>
          {shownReason}
        </span>
      ) : null}
    </span>
  );
}
