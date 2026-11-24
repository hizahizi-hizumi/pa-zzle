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
 * - `select`: 1つ目を押して選ぶ。
 * - `deselect`: 選んでいる1つ目をもう一度押して、選ぶのをやめる。
 */
export type FukumenzanExampleMove =
  | {
      gesture: "tap" | "drag" | "toggle" | "tap-or-drag";
      from: FukumenzanExampleTarget;
      to: FukumenzanExampleTarget;
    }
  | { gesture: "select" | "deselect"; from: FukumenzanExampleTarget };

/** 例の図の下に添える判定。`leading-zero` は先頭の0のルール、`sum` は足し算のルール。 */
export type FukumenzanExampleVerdict = "leading-zero" | "sum";

export type FukumenzanHowToPlayExample = {
  placed: FukumenzanLetterDigits;
  crossed?: Readonly<Partial<Record<string, readonly FukumenzanDigit[]>>>;
  /** 例で見せる札。例が使う札の段だけか、× の数を見せる例では 0〜9 の全部。 */
  cardRow: "low" | "high" | "all";
  /** 押す所の手がかりで、この順に見せる手。できない形の例には手がかりを付けないので、空にする。 */
  moves: readonly FukumenzanExampleMove[];
  verdict?: FukumenzanExampleVerdict;
  /** 判定の代わりに例の下に出す、手を打ち終えた数ごとの起きたこと。`null` の所では何も出さない。 */
  outcomes?: readonly (string | null)[];
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

/** 空の式の D へ 8 を運ぶと D の全部の場所に入り、その 8 を E へ運ぶと D が空く。同じ札は2つの文字に入らない。 */
export const sameLetterRuleExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  moves: [
    { gesture: "tap-or-drag", from: card(8), to: letter("D") },
    { gesture: "drag", from: letter("D"), to: letter("E") },
  ],
  outcomes: [null, "4つの D に 8 が入る", "8 が E へ移り D が空く"],
};

/**
 * 先頭の0のルールの、できる形とできない形。できる形は先頭の M と D に 1 と 8 を入れた形で、D に 0 を入れる手を示す。
 * できない形は、その手を打った後の形。
 */
export const leadingZeroRuleExamples = [
  {
    placed: { M: 1, D: 8 },
    cardRow: "low",
    moves: [{ gesture: "tap-or-drag", from: card(0), to: letter("D") }],
    verdict: "leading-zero",
  },
  {
    placed: { M: 1, D: 0 },
    cardRow: "low",
    moves: [],
    verdict: "leading-zero",
  },
] as const satisfies readonly FukumenzanHowToPlayExample[];

/**
 * 足し算のルールの、一の位と十の位が合う形と、十の位が合わない形。合う形は 198 + 882 の下2桁で、R に 7 を入れる手を示す。
 * できない形は、その手を打った後の形。
 */
export const sumRuleExamples = [
  {
    placed: { D: 8, E: 2, U: 0, R: 9 },
    cardRow: "high",
    moves: [{ gesture: "tap-or-drag", from: card(7), to: letter("R") }],
    verdict: "sum",
  },
  {
    placed: { D: 8, E: 2, U: 0, R: 7 },
    cardRow: "high",
    moves: [],
    verdict: "sum",
  },
] as const satisfies readonly FukumenzanHowToPlayExample[];

/** 十の位は合わないが一の位の U が空いていて線が出ない形。U に 0 を入れると一の位から続けて埋まり、十の位に線が出る。 */
export const miscalculationLineRuleExample: FukumenzanHowToPlayExample = {
  placed: { R: 7, D: 8, E: 2 },
  cardRow: "low",
  moves: [{ gesture: "tap-or-drag", from: card(0), to: letter("U") }],
  outcomes: ["一の位が空いていて線が出ない", "十の位の答えの下に線が出る"],
};

/** 札を文字へ運ぶか、札を押してから文字を押して、札を入れる。始まりの盤面が同じ2つの手を、1つの例で見せる。 */
export const placeOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  moves: [{ gesture: "tap-or-drag", from: card(8), to: letter("D") }],
};

/** 札の入った文字へ別の札を入れる。 */
export const replaceOperationExample: FukumenzanHowToPlayExample = {
  placed: { D: 6 },
  cardRow: "high",
  moves: [{ gesture: "tap", from: card(8), to: letter("D") }],
};

/** 札の入った文字から別の文字へ札を運ぶ。 */
export const moveOperationExample: FukumenzanHowToPlayExample = {
  placed: { U: 8 },
  cardRow: "high",
  moves: [{ gesture: "drag", from: letter("U"), to: letter("D") }],
};

/** 文字を押してから札を押して、× を付け外しする。 */
export const crossOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  cardRow: "high",
  moves: [{ gesture: "toggle", from: letter("U"), to: card(5) }],
};

/** × を付けた U を押して選ぶと札に × が出て、U をもう一度押すと選ぶのをやめて × が消える。 */
export const crossShownOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  crossed: { U: [5, 6, 7] },
  cardRow: "all",
  moves: [
    { gesture: "select", from: letter("U") },
    { gesture: "deselect", from: letter("U") },
  ],
};

/** U に × を付けた 8 も、U を選んで × を見てから U へ運ぶと入る。 */
export const crossedCardPlaceOperationExample: FukumenzanHowToPlayExample = {
  placed: {},
  crossed: { U: [8] },
  cardRow: "high",
  moves: [
    { gesture: "select", from: letter("U") },
    { gesture: "drag", from: card(8), to: letter("U") },
  ],
};

/** 札の入った文字を押してから列の空いた場所を押すか、札の並びへ運んで、札を列へ戻す。 */
export const returnOperationExample: FukumenzanHowToPlayExample = {
  placed: { D: 8 },
  cardRow: "high",
  moves: [{ gesture: "tap-or-drag", from: letter("D"), to: card(8) }],
};

/**
 * × の跡の図。D に 8 を入れ、U を選んで 2〜7 と 9 に × を付けた式。U の右上の丸は、× の付いていない 0・1・8 の3。
 * D に入った 8 も、U に × を付けていないので数に入る。
 */
export const candidateCountFigure = {
  placed: { D: 8 },
  crossed: { U: [2, 3, 4, 5, 6, 7, 9] },
} as const satisfies Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
