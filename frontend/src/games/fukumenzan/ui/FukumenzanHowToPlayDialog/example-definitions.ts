import { fukumenzanGuideExampleProblems } from "@/games/fukumenzan/problem/guide-examples";
import type { FukumenzanDigit } from "@/games/fukumenzan/puzzle/state";

/** 遊び方の例と図の式。答えは 198 + 882 = 1080。 */
export const howToPlayProblem = fukumenzanGuideExampleProblems.howToPlay;

/** 文字ごとの数字。書かない文字は空。 */
export type FukumenzanLetterDigits = Readonly<
  Partial<Record<string, FukumenzanDigit>>
>;

/** 押す所。`card` は札か、札が文字に入っているならその札の空いた場所。 */
export type FukumenzanExampleTarget =
  | { kind: "letter"; letter: string }
  | { kind: "card"; digit: FukumenzanDigit };

/**
 * 例が見せる1手の、押す所の順。
 * - `tap`: 1つ目を押してから2つ目を押す。
 * - `drag`: 1つ目から2つ目へ運ぶ。手がかりは運び始めたときだけ2つ目へ進める。
 * - `toggle`: 1つ目を押してから2つ目を押す。2つ目は押すたびに付け外しするので、1つ目を選んでいる間は2つ目を示し続ける。
 * - `tap-or-drag`: 1つ目を押してから2つ目を押すか、1つ目から2つ目へ運ぶ。押して選んでも、運び始めても2つ目を示す。
 * - `select`: 1つ目を押して選ぶだけ。選んだら手がかりを消す。
 */
export type FukumenzanExampleMove =
  | {
      gesture: "tap" | "drag" | "toggle" | "tap-or-drag";
      from: FukumenzanExampleTarget;
      to: FukumenzanExampleTarget;
    }
  | { gesture: "select"; from: FukumenzanExampleTarget };

/** 例の図の下に添える判定。`leading-zero` は先頭の0のルール、`sum` は足し算のルール。 */
export type FukumenzanExampleVerdict = "leading-zero" | "sum";

export type FukumenzanHowToPlayExample = {
  placed: FukumenzanLetterDigits;
  crossed?: Readonly<Partial<Record<string, readonly FukumenzanDigit[]>>>;
  /** 例で見せる札。例が使う札の段だけか、× の数を見せる例では 0〜9 の全部。 */
  cardRow: "low" | "high" | "all";
  /** 押す所の手がかりで見せる手。できない形の例は最初から静止させるので持たない。 */
  move: FukumenzanExampleMove | null;
  verdict?: FukumenzanExampleVerdict;
};

const lowCards = [0, 1, 2, 3, 4] as const satisfies FukumenzanDigit[];
const highCards = [5, 6, 7, 8, 9] as const satisfies FukumenzanDigit[];

export const exampleCardRows = {
  low: lowCards,
  high: highCards,
  all: [...lowCards, ...highCards],
} as const;

function letter(text: string): FukumenzanExampleTarget {
  return { kind: "letter", letter: text };
}

function card(digit: FukumenzanDigit): FukumenzanExampleTarget {
  return { kind: "card", digit };
}

/** ゴールの盤面で札を入れていく順。筆算を確かめる順に、一の位の文字から入れる。 */
export const goalSteps: readonly {
  letter: string;
  digit: FukumenzanDigit;
}[] = [
  { letter: "D", digit: 8 },
  { letter: "E", digit: 2 },
  { letter: "U", digit: 0 },
  { letter: "R", digit: 9 },
  { letter: "M", digit: 1 },
];

/** E の 8 を D へ運ぶと、D の全部の場所に 8 が入り、E は空になる。同じ札は2つの文字に入らない。 */
export const sameLetterRuleExample: FukumenzanHowToPlayExample = {
  placed: { E: 8 },
  cardRow: "high",
  move: { gesture: "drag", from: letter("E"), to: letter("D") },
};

/** 先頭の0のルールの、できる形とできない形。できる形は、答えに沿って D に 8 を入れる手を示す。 */
export const leadingZeroRuleExamples = [
  {
    placed: { M: 1 },
    cardRow: "high",
    move: { gesture: "tap", from: card(8), to: letter("D") },
    verdict: "leading-zero",
  },
  {
    placed: { M: 1, D: 0 },
    cardRow: "low",
    move: null,
    verdict: "leading-zero",
  },
] as const satisfies readonly FukumenzanHowToPlayExample[];

/** 足し算のルールの、一の位と十の位が合う形と、十の位が合わない形。合う形は、R に 9 を入れる手を示す。 */
export const sumRuleExamples = [
  {
    placed: { D: 8, E: 2, U: 0 },
    cardRow: "high",
    move: { gesture: "tap", from: card(9), to: letter("R") },
    verdict: "sum",
  },
  {
    placed: { D: 8, E: 2, U: 0, R: 7 },
    cardRow: "high",
    move: null,
    verdict: "sum",
  },
] as const satisfies readonly FukumenzanHowToPlayExample[];

/** 札を文字へ運ぶか、札を押してから文字を押して、札を入れる。始まりの盤面が同じ2つの手を、1つの例で見せる。 */
export const placeOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  move: { gesture: "tap-or-drag", from: card(8), to: letter("D") },
};

/** 札の入った文字へ別の札を入れる。 */
export const replaceOperationExample: FukumenzanHowToPlayExample = {
  placed: { D: 6 },
  cardRow: "high",
  move: { gesture: "tap", from: card(8), to: letter("D") },
};

/** 札の入った文字から別の文字へ札を運ぶ。 */
export const moveOperationExample: FukumenzanHowToPlayExample = {
  placed: { U: 8 },
  cardRow: "high",
  move: { gesture: "drag", from: letter("U"), to: letter("D") },
};

/** 文字を押してから札を押して、× を付け外しする。 */
export const crossOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  move: { gesture: "toggle", from: letter("U"), to: card(5) },
};

/** × を付けた U を押して選ぶと、札に × が出る。U をもう一度押すか、式と札の外を押すと、選ぶのをやめて × が消える。 */
export const crossShownOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  crossed: { U: [5, 6, 7] },
  cardRow: "all",
  move: { gesture: "select", from: letter("U") },
};

/** 札の入った文字を押してから列の空いた場所を押すか、札の並びへ運んで、札を列へ戻す。 */
export const returnOperationExample: FukumenzanHowToPlayExample = {
  placed: { D: 8 },
  cardRow: "high",
  move: { gesture: "tap-or-drag", from: letter("D"), to: card(8) },
};

/**
 * × の跡の図。D に 8 を入れ、U を選んで 2〜7 と 9 に × を付けた式。U の右上の丸は、× の付いていない 0・1・8 の3。
 * D に入った 8 も、U に × を付けていないので数に入る。
 */
export const candidateCountFigure = {
  placed: { D: 8 },
  crossed: { U: [2, 3, 4, 5, 6, 7, 9] },
} as const satisfies Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
