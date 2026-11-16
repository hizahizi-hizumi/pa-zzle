import type { ReactNode } from "react";

import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
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
  /**
   * 例が教えるルールとは別に、手が弾かれた・盤面が崩れたわけ（別のルールの名前）。判定によらず判定の下に添える。
   * `ruleReason` と両方あるときは、こちらを添える。
   */
  reason?: string;
  /**
   * 例が教えるルールそのもののわけ（残ったマスの数・出た先の数字など、盤面からは読み取りにくい判定の根拠）。
   * 判定の下に、判定と同じ色で添える。
   */
  ruleReason?: string;
  /** 判定の右に添える物（行の数・見比べる所の凡例など）。判定を盤面の中央に置いたまま、右の列に置く。 */
  aside?: ReactNode;
};

const verdictStates = ["allowed", "disallowed", "incomplete"] as const;

const incompleteLabel = "途中";

/**
 * 触れる例の今の姿の判定（✓ / ✕ と言葉、または途中）。記号と言葉の1行は `HowToPlayVerdictLine` で描き、
 * 判定の言葉は `HowToPlayCaptionLayers` で同じ場所に重ねて入れ替える。
 * 右に添える物があるときも、判定の言葉を例の盤面の中央に置き、添える物はその右に並べる。
 * 判定の下に添えるわけは、行の高さを取らずに判定の下に重ね、判定と周りを動かさない。例を並べる面が、その高さの分の間を例の下に取る。
 * わけの幅は場所に数え、例の幅をわけと盤面の広い方にして、隣の例の言葉と重ならないようにする。わけもまとまりの中央に置く。
 * ✓ と ✕ はどのゲームでも文字の色で描き、途中だけを淡い色にする。ゲームの不成立はアプリのエラーとして表さない（`DESIGN.md` の「操作への反応」）ので、
 * 本番の違反の印の色を判定の言葉へ移さない。違反の色は盤面の印に任せる。
 */
export function HowToPlayVerdict({
  verdict,
  labels,
  reason,
  ruleReason,
  aside,
}: HowToPlayVerdictProps) {
  const toneClassNames = {
    allowed: "text-foreground",
    disallowed: "text-foreground",
    incomplete: "text-muted-foreground",
  } as const satisfies Record<HowToPlayVerdictState, string>;
  const words = { ...labels, incomplete: incompleteLabel };
  const below =
    reason !== undefined
      ? { text: reason, className: "text-foreground" }
      : ruleReason !== undefined
        ? { text: ruleReason, className: toneClassNames[verdict] }
        : null;
  const line = (
    <HowToPlayCaptionLayers
      layers={verdictStates.map((shown) => ({
        id: shown,
        shown: shown === verdict,
        content: (
          <span className={cn("flex", toneClassNames[shown])}>
            <HowToPlayVerdictLine
              mark={
                shown === "incomplete" ? undefined : (
                  <HowToPlayVerdictMark verdict={shown} />
                )
              }
            >
              {words[shown]}
            </HowToPlayVerdictLine>
          </span>
        ),
      }))}
    />
  );
  return (
    <span data-how-to-play-verdict className="flex flex-col items-center">
      {aside === undefined ? (
        line
      ) : (
        // 同じ幅の左右の列の真ん中に判定を置き、判定を盤面の中央に保ったまま右の列に添える物を置く。
        <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span aria-hidden="true" />
          {line}
          <span data-how-to-play-verdict-aside className="flex justify-start">
            {aside}
          </span>
        </span>
      )}
      {below === null ? null : (
        <span
          data-how-to-play-verdict-reason
          className={cn("h-0 whitespace-nowrap", below.className)}
        >
          <span className="sr-only">・</span>
          {below.text}
        </span>
      )}
    </span>
  );
}
