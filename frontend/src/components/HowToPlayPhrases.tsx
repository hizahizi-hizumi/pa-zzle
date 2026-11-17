import { cn } from "@/lib/utils";

type HowToPlayPhrasesProps = {
  /** 文。`/` で区切った文節の間でだけ折り返す。`/` は描かない。 */
  text: string;
};

const openingBrackets = new Set(["「", "『", "（", "【", "〔"]);

/**
 * 文を、区切った文節の途中で折り返さないよう、文節ごとにまとめて描く。
 * 幅に余裕があれば1行に並び、足りなければ文節の切れ目で折り返す。
 */
export function HowToPlayPhrases({ text }: HowToPlayPhrasesProps) {
  const phrases = text.split("/");
  return phrases.map((phrase, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: 文節は文の中の並び順そのものが識別になる
      key={index}
      className={cn(
        "inline-block",
        // アプリの書体は halt を持たず text-spacing-trim が効かないので、始め括弧の左の半角の空きを詰める。
        // 前の文節の後ろに同じ幅を足して打ち消すので、詰まるのは折り返した行の頭だけになる。
        startsWithOpeningBracket(phrase) && "-ms-[0.5em]",
        startsWithOpeningBracket(phrases[index + 1]) && "me-[0.5em]",
      )}
    >
      {phrase}
    </span>
  ));
}

function startsWithOpeningBracket(phrase: string | undefined): boolean {
  return phrase !== undefined && openingBrackets.has(phrase.charAt(0));
}
