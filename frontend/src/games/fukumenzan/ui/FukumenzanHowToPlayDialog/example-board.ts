import {
  getFukumenzanEquationStructure,
  listFukumenzanLetters,
} from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";
import type {
  FukumenzanCardDrag,
  FukumenzanSelection,
} from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import {
  type FukumenzanExampleTarget,
  type FukumenzanExampleVerdict,
  type FukumenzanHowToPlayExample,
  howToPlayProblem,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

const letters = listFukumenzanLetters(howToPlayProblem);

export function getExampleLetterIndex(letter: string): number {
  const index = letters.indexOf(letter);
  if (index < 0) {
    throw new RangeError(`Fukumenzan example letter is missing: ${letter}`);
  }
  return index;
}

export function createExamplePuzzleState(
  example: Pick<FukumenzanHowToPlayExample, "placed" | "crossed">,
): FukumenzanPuzzleState {
  return {
    placedDigits: letters.map((letter) => example.placed[letter] ?? null),
    crossedDigits: letters.map((letter) => example.crossed?.[letter] ?? []),
  };
}

function isSameState(
  left: FukumenzanPuzzleState,
  right: FukumenzanPuzzleState,
): boolean {
  return (
    left.placedDigits.every(
      (digit, letter) => digit === right.placedDigits[letter],
    ) &&
    left.crossedDigits.every(
      (digits, letter) => digits.join() === right.crossedDigits[letter]?.join(),
    )
  );
}

export function isExampleChanged(
  example: FukumenzanHowToPlayExample,
  state: FukumenzanPuzzleState,
): boolean {
  return !isSameState(createExamplePuzzleState(example), state);
}

function isSelected(
  target: FukumenzanExampleTarget,
  selection: FukumenzanSelection,
): boolean {
  return target.kind === "letter"
    ? selection?.kind === "letter" &&
        selection.letter === getExampleLetterIndex(target.letter)
    : selection?.kind === "card" && selection.digit === target.digit;
}

function isDragged(
  target: FukumenzanExampleTarget,
  drag: FukumenzanCardDrag,
): boolean {
  return target.kind === "letter"
    ? drag.fromLetter === getExampleLetterIndex(target.letter)
    : drag.fromLetter === null && drag.digit === target.digit;
}

/**
 * 次に押す所。触る前の姿から例の手を打っていく途中でだけ示し、手を打ち終えたら消す。
 * 運ぶ手は運び始めたときだけ落とし先へ進め、押して選んだだけなら運び始める所を示したままにする。
 * 付け外しの手は、1つ目を選んでいる間、付けた後も2つ目を示し続ける。
 */
export function findExampleHint(
  example: FukumenzanHowToPlayExample,
  state: FukumenzanPuzzleState,
  selection: FukumenzanSelection,
  drag: FukumenzanCardDrag | null,
): FukumenzanExampleTarget | null {
  const { move } = example;
  if (move === null) {
    return null;
  }
  const changed = isExampleChanged(example, state);
  if (drag !== null) {
    return move.gesture === "drag" && !changed && isDragged(move.from, drag)
      ? move.to
      : null;
  }
  if (isSelected(move.from, selection)) {
    if (move.gesture === "toggle") {
      return move.to;
    }
    if (!changed) {
      return move.gesture === "drag" ? move.from : move.to;
    }
    return null;
  }
  return !changed && selection === null ? move.from : null;
}

/** 判定。埋まるまで決まらない間は `incomplete`。 */
export type FukumenzanExampleJudgement =
  | "allowed"
  | "disallowed"
  | "incomplete";

/** 足し算の例で、合うと言うまでに埋める桁。一の位と十の位。 */
const SUM_JUDGED_COLUMN_COUNT = 2;

/**
 * 今の盤面の判定。どちらも本番の知らせと同じ関数で求める。
 * - 先頭の0: 先頭の文字のどれかが0ならできない。先頭の文字が全部埋まって0が無ければできる。
 * - 足し算: 本番が計算違いの印を付ける桁が1つでもあれば合わない。印が無く、一の位と十の位が埋まっていれば合う。
 */
export function judgeExample(
  verdict: FukumenzanExampleVerdict,
  state: FukumenzanPuzzleState,
): FukumenzanExampleJudgement {
  const { leadingLetters, columns } =
    getFukumenzanEquationStructure(howToPlayProblem);
  if (verdict === "leading-zero") {
    if (listFukumenzanLeadingZeroLetters(howToPlayProblem, state).length > 0) {
      return "disallowed";
    }
    return leadingLetters.every((letter) => state.placedDigits[letter] !== null)
      ? "allowed"
      : "incomplete";
  }
  if (listFukumenzanMiscalculatedColumns(howToPlayProblem, state).length > 0) {
    return "disallowed";
  }
  return columns
    .slice(0, SUM_JUDGED_COLUMN_COUNT)
    .every(({ addendLetters, resultLetter }) =>
      [...addendLetters, resultLetter].every(
        (letter) => state.placedDigits[letter] !== null,
      ),
    )
    ? "allowed"
    : "incomplete";
}

/** 例が教えるルールとは別のルールの印が盤面に出ているときに、判定の下に添えるわけ。出ていなければ `undefined`。 */
export function describeOtherRuleMark(
  verdict: FukumenzanExampleVerdict,
  state: FukumenzanPuzzleState,
): string | undefined {
  if (verdict === "leading-zero") {
    return listFukumenzanMiscalculatedColumns(howToPlayProblem, state).length >
      0
      ? "足し算の合わない桁に赤い線が出ています"
      : undefined;
  }
  return listFukumenzanLeadingZeroLetters(howToPlayProblem, state).length > 0
    ? "先頭が0の数のマスが赤くなっています"
    : undefined;
}
