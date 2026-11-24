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
 */
export type FukumenzanExampleMove = {
  gesture: "tap" | "drag" | "toggle";
  from: FukumenzanExampleTarget;
  to: FukumenzanExampleTarget;
};

/** 例の図の下に添える判定。`leading-zero` は先頭の0のルール、`sum` は足し算のルール。 */
export type FukumenzanExampleVerdict = "leading-zero" | "sum";

export type FukumenzanHowToPlayExample = {
  placed: FukumenzanLetterDigits;
  crossed?: Readonly<Partial<Record<string, readonly FukumenzanDigit[]>>>;
  /** 例で見せる札の列の段。例が使う札の段だけを見せる。 */
  cardRow: "low" | "high";
  /** 押す所の手がかりで見せる手。できない形の例は最初から静止させるので持たない。 */
  move: FukumenzanExampleMove | null;
  verdict?: FukumenzanExampleVerdict;
};

const lowCards = [0, 1, 2, 3, 4] as const satisfies FukumenzanDigit[];
const highCards = [5, 6, 7, 8, 9] as const satisfies FukumenzanDigit[];

export const exampleCardRows = {
  low: lowCards,
  high: highCards,
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
  { letter: "X", digit: 2 },
  { letter: "U", digit: 0 },
  { letter: "R", digit: 9 },
  { letter: "M", digit: 1 },
];

/** X の 8 を D へ運ぶと、D の全部の場所に 8 が入り、X は空になる。同じ札は2つの文字に入らない。 */
export const sameLetterRuleExample: FukumenzanHowToPlayExample = {
  placed: { X: 8 },
  cardRow: "high",
  move: { gesture: "drag", from: letter("X"), to: letter("D") },
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
    placed: { D: 8, X: 2, U: 0 },
    cardRow: "high",
    move: { gesture: "tap", from: card(9), to: letter("R") },
    verdict: "sum",
  },
  {
    placed: { D: 8, X: 2, U: 0, R: 7 },
    cardRow: "high",
    move: null,
    verdict: "sum",
  },
] as const satisfies readonly FukumenzanHowToPlayExample[];

/** 札を文字へ運ぶ。 */
export const dragOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  move: { gesture: "drag", from: card(8), to: letter("D") },
};

/** 札を押してから文字を押す。 */
export const tapOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  move: { gesture: "tap", from: card(8), to: letter("D") },
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

/** 札の入った文字を押してから列の空いた場所を押して、札を列へ戻す。 */
export const returnOperationExample: FukumenzanHowToPlayExample = {
  placed: { D: 8 },
  cardRow: "high",
  move: { gesture: "tap", from: letter("D"), to: card(8) },
};

/** × の跡の図。U に 2〜9 の × を付け、残りの候補を 0 と 1 の2つにした式。 */
export const candidateCountFigure = {
  placed: {},
  crossed: { U: [2, 3, 4, 5, 6, 7, 8, 9] },
} as const satisfies Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
