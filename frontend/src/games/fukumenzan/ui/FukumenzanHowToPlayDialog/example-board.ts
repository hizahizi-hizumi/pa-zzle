import {
  getFukumenzanEquationStructure,
  listFukumenzanLetters,
} from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import type {
  FukumenzanCardDrag,
  FukumenzanSelection,
} from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import {
  type FukumenzanExampleMove,
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

/** 手を打った後の盤面。本番の入力が同じ手で呼ぶ遷移で求める。選ぶ・選ぶのをやめる手は盤面を変えない。 */
function applyExampleMove(
  state: FukumenzanPuzzleState,
  move: FukumenzanExampleMove,
): FukumenzanPuzzleState {
  if (!("to" in move)) {
    return state;
  }
  const { from, to } = move;
  if (move.gesture === "toggle") {
    if (from.kind !== "letter" || to.kind !== "card") {
      throw new RangeError(
        "Fukumenzan toggle move goes from a letter to a card",
      );
    }
    return toggleFukumenzanCross(
      state,
      getExampleLetterIndex(from.letter),
      to.digit,
    );
  }
  if (to.kind === "card") {
    if (from.kind !== "letter") {
      throw new RangeError("Fukumenzan return move starts from a letter");
    }
    return returnFukumenzanDigit(state, getExampleLetterIndex(from.letter));
  }
  const digit =
    from.kind === "card"
      ? from.digit
      : state.placedDigits[getExampleLetterIndex(from.letter)];
  if (digit === null || digit === undefined) {
    throw new RangeError(
      "Fukumenzan example moves a card from an empty letter",
    );
  }
  return placeFukumenzanDigit(state, getExampleLetterIndex(to.letter), digit);
}

/**
 * 例が見せる手をどこまで打ったか。盤面が手を打っていった途中の形のどれかで、その手の前に選ぶ手があれば選んだままのときの、
 * 打ち終えた手の数。手の道から外れていれば `null`。
 * 選ぶのをやめる手の後は、選ぶ前と同じ姿なので、最初の手の前に数える。
 */
export function findExampleStep(
  example: FukumenzanHowToPlayExample,
  state: FukumenzanPuzzleState,
  selection: FukumenzanSelection,
): number | null {
  const { moves } = example;
  const states = [createExamplePuzzleState(example)];
  for (const move of moves) {
    states.push(applyExampleMove(states[states.length - 1]!, move));
  }
  for (let step = moves.length; step >= 0; step -= 1) {
    const previous = moves[step - 1];
    if (
      isSameState(states[step]!, state) &&
      previous?.gesture !== "deselect" &&
      (previous?.gesture !== "select" || isSelected(previous.from, selection))
    ) {
      return step;
    }
  }
  return null;
}

/**
 * 1つの手の、次に押す所。運ぶ手は運び始めたときだけ落とし先へ進め、押して選んだだけなら運び始める所を示したままにする。
 * 押すか運ぶ手は、押して選んでも運び始めても2つ目へ進める。
 * 手を始める所は、何も選んでいないか、前の手で選んだ物を選んだままのときに示す。
 */
function findMoveHint(
  move: FukumenzanExampleMove,
  heldSelection: FukumenzanExampleTarget | null,
  selection: FukumenzanSelection,
  drag: FukumenzanCardDrag | null,
): FukumenzanExampleTarget | null {
  if (!("to" in move)) {
    return move.gesture === "select"
      ? selection === null && drag === null
        ? move.from
        : null
      : drag === null && isSelected(move.from, selection)
        ? move.from
        : null;
  }
  if (drag !== null) {
    return (move.gesture === "drag" || move.gesture === "tap-or-drag") &&
      isDragged(move.from, drag)
      ? move.to
      : null;
  }
  if (isSelected(move.from, selection)) {
    return move.gesture === "drag" ? move.from : move.to;
  }
  const idle =
    selection === null ||
    (heldSelection !== null && isSelected(heldSelection, selection));
  return idle ? move.from : null;
}

/**
 * 次に押す所。触る前の姿から例の手を順に打っていく途中でだけ示し、手を打ち終えたら消す。
 * 付け外しの手は、1つ目を選んでいる間、付けた後も2つ目を示し続ける。
 */
export function findExampleHint(
  example: FukumenzanHowToPlayExample,
  state: FukumenzanPuzzleState,
  selection: FukumenzanSelection,
  drag: FukumenzanCardDrag | null,
): FukumenzanExampleTarget | null {
  const { moves } = example;
  const step = findExampleStep(example, state, selection);
  if (step === null || step === moves.length) {
    const last = moves.at(-1);
    return last?.gesture === "toggle" &&
      drag === null &&
      isSelected(last.from, selection)
      ? last.to
      : null;
  }
  const previous = moves[step - 1];
  return findMoveHint(
    moves[step]!,
    previous?.gesture === "select" ? previous.from : null,
    selection,
    drag,
  );
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
    ? "いちばん左の0が赤くなっています"
    : undefined;
}

/** 桁の呼び名。一の位から順に並べる。 */
const placeNames = ["一", "十", "百", "千", "万"] as const;

/**
 * 例が教えるルールで ✕ になったわけ。✕ が「入れられない」と読まれないよう、どこがルールに合わないかを言う。✕ でなければ `undefined`。
 * 足し算は、本番が線を引く桁のうち一の位にいちばん近い桁を言う。
 */
export function describeRuleReason(
  verdict: FukumenzanExampleVerdict,
  state: FukumenzanPuzzleState,
): string | undefined {
  if (judgeExample(verdict, state) !== "disallowed") {
    return undefined;
  }
  if (verdict === "leading-zero") {
    return "いちばん左が0";
  }
  const [place] = listFukumenzanMiscalculatedColumns(howToPlayProblem, state);
  return `${placeNames[place!]}の位が合わない`;
}
