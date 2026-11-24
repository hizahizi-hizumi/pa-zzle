import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

type HowToPlayPhrasesProps = {
  /** 文。`/` で区切った文節の間でだけ折り返す。`/` は描かない。 */
  text: string;
  /**
   * 最後の行に短い文節だけが残らないよう（「やり直します。」だけの行など）、文の終わりの短い文節を前の文節とまとめて折り返さないか。
   * まとめた文節が次の行へ送られ、前の行が文の列の幅の8割に届かずに折れるときは、まとめない。
   * 渡すときは、文節を並べる要素の組み方を `text-wrap: wrap` にし、書体の組み方で行を詰め直させない。
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

/** まとめた文節の前の行が、文の列の幅のこの割合より短く折れるなら、まとめない。 */
const MIN_PREVIOUS_LINE_RATIO = 0.8;

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
 * まとめた文節（`bound`）が前の文節と別の行に送られ、前の行が文の列（文節を並べる要素の内側）の幅の
 * `MIN_PREVIOUS_LINE_RATIO` に届かずに折れているか。
 */
function leavesShortPreviousLine(bound: HTMLElement): boolean {
  const previous = bound.previousElementSibling;
  const column = bound.parentElement;
  if (
    !(previous instanceof HTMLElement) ||
    column === null ||
    bound.offsetTop <= previous.offsetTop
  ) {
    return false;
  }
  const style = getComputedStyle(column);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const left =
    column.getBoundingClientRect().left + column.clientLeft + paddingLeft;
  const width = column.clientWidth - paddingLeft - paddingRight;
  return (
    previous.getBoundingClientRect().right - left <
    width * MIN_PREVIOUS_LINE_RATIO
  );
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
  const bound = avoidShortLastLine ? bindLastPhrases(split) : split;
  const binds = bound.length < split.length;
  // まとめると前の行が短くなった文。文の列の幅が変わるまで、その文はまとめずに描く。
  const [unboundText, setUnboundText] = useState<string | null>(null);
  const unbinds = unboundText === text;
  const lastRef = useRef<HTMLSpanElement>(null);
  const phrases = binds && !unbinds ? bound : split;

  // 行の折れ方は描いた後にしか分からないので、まとめて描いた行を測り、前の行が短くなっていれば、まとめずに描き直す。
  // 文の列の幅が変わったら、まとめて描き直して測り直す。
  useLayoutEffect(() => {
    const last = lastRef.current;
    const column = last?.parentElement;
    if (!binds || last === null || column === null || column === undefined) {
      return;
    }
    if (!unbinds && leavesShortPreviousLine(last)) {
      setUnboundText(text);
      return;
    }
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const width = column.clientWidth;
    const resizes = new ResizeObserver(() => {
      if (column.clientWidth === width) {
        return;
      }
      if (unbinds) {
        setUnboundText(null);
      } else if (leavesShortPreviousLine(last)) {
        setUnboundText(text);
      }
    });
    resizes.observe(column);
    return () => resizes.disconnect();
  }, [binds, text, unbinds]);

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
        ref={index === phrases.length - 1 ? lastRef : undefined}
        className="inline-block"
        style={indent === null && nextIndent === null ? undefined : style}
      >
        {phrase}
      </span>
    );
  });
}
