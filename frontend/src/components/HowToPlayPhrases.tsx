import type { CSSProperties } from "react";

type HowToPlayPhrasesProps = {
  /** 文。`/` で区切った文節の間でだけ折り返す。`/` は描かない。 */
  text: string;
};

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

/**
 * 文を、区切った文節の途中で折り返さないよう、文節ごとにまとめて描く。
 * 幅に余裕があれば1行に並び、足りなければ文節の切れ目で折り返す。
 * 始め括弧で始まる文節は、括弧の左の空きを詰めて、行の頭でも括弧を本文の列にそろえる。
 * 前の文節の後ろに同じ幅を足して打ち消すので、詰まるのは折り返した行の頭と文の頭だけになる。
 * 書体が詰める仕組み（`text-spacing-trim`）を持つ環境で二重に詰めないよう、括弧の文節ではその仕組みを止める。
 */
export function HowToPlayPhrases({ text }: HowToPlayPhrasesProps) {
  const phrases = text.split("/");
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
