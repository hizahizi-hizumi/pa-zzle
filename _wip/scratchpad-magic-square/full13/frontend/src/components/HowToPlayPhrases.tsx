import type { CSSProperties } from "react";

type HowToPlayPhrasesProps = {
  /** 文。`/` で区切った文節の間でだけ折り返す。`/` は描かない。 */
  text: string;
  /**
   * 最後の行に短い文節だけが残らないよう（「やり直します。」だけの行など）、文の終わりの短い文節を前の文節とまとめて折り返さないか。
   * 渡さなければ、どの文節の間でも折り返せる。
   */
  avoidShortLastLine?: boolean;
};

/**
 * 終わりの文節をまとめるときの字数。まとめた文節が `SHORT_LAST_LINE_CHARS` 字に届くまで前の文節を足し、
 * `BOUND_PHRASE_MAX_CHARS` 字を超えるなら足さない（長い塊で前の行を早く折り返させない）。
 */
const SHORT_LAST_LINE_CHARS = 8;
const BOUND_PHRASE_MAX_CHARS = 14;

/**
 * 始め括弧の字形の左の空き（em）から、ほかの字の左の空き（約 0.06em）を除いた幅。
 * アプリの書体（M PLUS 2）の字形を、普通の太さと太字で測った値の小さい方にし、行の頭で括弧の線が本文の列から出ないようにする。
 */
const openingBracketIndents = {
  "「": 0.46,
  "『": 0.41,
  "（": 0.54,
  "【": 0.53,
  "〔": 0.42,
} as const satisfies Record<string, number>;

type OpeningBracket = keyof typeof openingBracketIndents;

function isOpeningBracket(character: string): character is OpeningBracket {
  return Object.hasOwn(openingBracketIndents, character);
}

function findOpeningBracketIndent(phrase: string | undefined): number | null {
  const first = phrase?.charAt(0);
  return first !== undefined && isOpeningBracket(first)
    ? openingBracketIndents[first]
    : null;
}

function countChars(phrase: string | undefined): number {
  return [...(phrase ?? "")].length;
}

/** 終わりの短い文節を、前の文節とまとめた並び。 */
function bindLastPhrases(phrases: readonly string[]): string[] {
  let start = phrases.length - 1;
  let chars = countChars(phrases[start]);
  while (start > 0 && chars < SHORT_LAST_LINE_CHARS) {
    const bound = chars + countChars(phrases[start - 1]);
    if (bound > BOUND_PHRASE_MAX_CHARS) {
      break;
    }
    start -= 1;
    chars = bound;
  }
  return [...phrases.slice(0, start), phrases.slice(start).join("")];
}

/**
 * 文を、区切った文節の途中で折り返さないよう、文節ごとにまとめて描く。
 * 幅に余裕があれば1行に並び、足りなければ文節の切れ目で折り返す。
 * 始め括弧で始まる文節は、括弧の左の空きを詰めて、行の頭でも括弧を本文の列にそろえる。
 * 前の文節の後ろに同じ幅を足して打ち消すので、詰まるのは折り返した行の頭と文の頭だけになる。
 * 書体が詰める仕組み（`text-spacing-trim`）を持つ環境で二重に詰めないよう、括弧の文節ではその仕組みを止める。
 */
export function HowToPlayPhrases({
  text,
  avoidShortLastLine = false,
}: HowToPlayPhrasesProps) {
  const split = text.split("/");
  const phrases = avoidShortLastLine ? bindLastPhrases(split) : split;
  return phrases.map((phrase, index) => {
    const indent = findOpeningBracketIndent(phrase);
    const nextIndent = findOpeningBracketIndent(phrases[index + 1]);
    const style: CSSProperties = {
      ...(indent === null
        ? {}
        : { marginInlineStart: `-${indent}em`, textSpacingTrim: "space-all" }),
      ...(nextIndent === null ? {} : { marginInlineEnd: `${nextIndent}em` }),
    };
    return (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: 文節は文の中の並び順そのものが識別になる
        key={index}
        className="inline-block"
        style={indent === null && nextIndent === null ? undefined : style}
      >
        {phrase}
      </span>
    );
  });
}
