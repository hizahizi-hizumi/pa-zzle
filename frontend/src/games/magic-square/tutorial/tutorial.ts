import {
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  type MagicSquareBoard,
  parseMagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  enterMagicSquareValue,
  isMagicSquareLineViolation,
  isMagicSquareSolved,
  listMagicSquareLineEvaluations,
} from "@/games/magic-square/puzzle/rules";
import {
  createMagicSquareInitialState,
  type MagicSquareState,
} from "@/games/magic-square/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type MagicSquareTutorialRuleId = "line-sum" | "use-once";

/** 選ぶ操作で選びを変え、入れる操作で選んだマスに数を入れる。本番の数の欄と同じく、同じ数を押すと外す。 */
export type MagicSquareTutorialAction =
  | { type: "select"; cellIndex: number }
  | { type: "enter"; value: number };

/**
 * - `select`: 印のマスを選ばせる。手順の間はこのマスだけを選べる。
 * - `enter`: 印のマスを選んだまま、数の欄の印の数を押させる。手順の間はこの数だけを押せる。
 */
export type MagicSquareTutorialStep = TutorialStep<MagicSquareTutorialRuleId> &
  (
    | { kind: "select"; cellIndex: number }
    | { kind: "enter"; cellIndex: number; value: number }
  );

export type MagicSquareTutorialBoardState = {
  puzzleState: MagicSquareState;
  selectedCellIndex: number | null;
};

export type MagicSquareTutorialSituation = TutorialSituation<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialStep
>;

/**
 * 4×4 の魔方陣から5マスを空けた盤面。どの空きも、空きが1つだけの列の合計から決まる。
 * 左の縦の列から左上を決めると、1行目の空きが1つになる。
 */
const tutorialGivens = parseMagicSquareBoard([
  ". 4 5 .",
  "9 2 7 .",
  "8 . 12 1",
  "3 15 . 6",
]);
const tutorialSolution = parseMagicSquareBoard([
  "14 4 5 11",
  "9 2 7 16",
  "8 13 12 1",
  "3 15 10 6",
]);

const magicSum = getMagicSquareMagicSum(tutorialGivens.size);
const maxValue = getMagicSquareMaxValue(tutorialGivens.size);
const topLeftCell = 0;
const topRightCell = 3;

export const magicSquareTutorialPuzzle: { givens: MagicSquareBoard } = {
  givens: tutorialGivens,
};

const steps = [
  {
    kind: "select",
    cellIndex: topLeftCell,
    message: {
      headline: "空きが1つの列から読みます",
      detail: "左の縦の列は空きが1つ。そのマスを押して選びます。",
    },
    introducedRuleId: "line-sum",
  },
  {
    kind: "enter",
    cellIndex: topLeftCell,
    value: 14,
    message: {
      headline: `${magicSum} − 20 = 14`,
      detail: `列の下の数は今の合計です。${magicSum}に足りない14を、数の欄で押します。`,
    },
    introducedRuleId: null,
  },
  {
    kind: "select",
    cellIndex: topRightCell,
    message: {
      headline: "1行目も空きが1つになりました",
      detail: "右上のマスを選びます。",
    },
    introducedRuleId: null,
  },
  {
    kind: "enter",
    cellIndex: topRightCell,
    value: 11,
    message: {
      headline: `${magicSum} − 23 = 11`,
      detail: "使った数は数の欄で薄くなり、ほかのマスには置けません。",
    },
    introducedRuleId: "use-once",
  },
] as const satisfies readonly MagicSquareTutorialStep[];

function createStartState(): MagicSquareTutorialBoardState {
  return {
    puzzleState: createMagicSquareInitialState(tutorialGivens),
    selectedCellIndex: null,
  };
}

function hasViolation(puzzleState: MagicSquareState): boolean {
  return listMagicSquareLineEvaluations(puzzleState).some(({ status }) =>
    isMagicSquareLineViolation(status),
  );
}

function performGuided(
  step: MagicSquareTutorialStep,
  state: MagicSquareTutorialBoardState,
  action: MagicSquareTutorialAction,
): { state: MagicSquareTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (step.kind === "select") {
    return action.type === "select" && action.cellIndex === step.cellIndex
      ? {
          state: { ...state, selectedCellIndex: step.cellIndex },
          outcome: "stepped",
        }
      : { state, outcome: "ignored" };
  }
  if (
    action.type !== "enter" ||
    action.value !== step.value ||
    state.selectedCellIndex !== step.cellIndex
  ) {
    return { state, outcome: "ignored" };
  }
  return {
    state: {
      ...state,
      puzzleState: enterMagicSquareValue(
        tutorialGivens,
        state.puzzleState,
        step.cellIndex,
        step.value,
      ),
    },
    outcome: "stepped",
  };
}

function performFree(
  state: MagicSquareTutorialBoardState,
  action: MagicSquareTutorialAction,
): { state: MagicSquareTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (action.type === "select") {
    return action.cellIndex === state.selectedCellIndex
      ? { state, outcome: "ignored" }
      : {
          state: { ...state, selectedCellIndex: action.cellIndex },
          outcome: "continued",
        };
  }
  if (state.selectedCellIndex === null) {
    return { state, outcome: "ignored" };
  }
  const puzzleState = enterMagicSquareValue(
    tutorialGivens,
    state.puzzleState,
    state.selectedCellIndex,
    action.value,
  );
  if (puzzleState === state.puzzleState) {
    return { state, outcome: "ignored" };
  }
  const next = { ...state, puzzleState };
  if (isMagicSquareSolved(puzzleState)) {
    return {
      state: { ...next, selectedCellIndex: null },
      outcome: "solved",
    };
  }
  return {
    state: next,
    outcome: hasViolation(puzzleState) ? "violated" : "continued",
  };
}

export const magicSquareTutorial: Tutorial<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialStep,
  MagicSquareTutorialBoardState,
  MagicSquareTutorialAction
> = {
  intro: {
    purpose: `1から${maxValue}までの数を1回ずつ置いて、縦・横・斜めのどの列も同じ合計にそろえるパズルです。`,
    goalCaption: `どの列も合計${magicSum}にそろえば完成です。`,
  },
  rules: [
    {
      id: "line-sum",
      label: `縦・横・斜めのどの列も、合計を${magicSum}にそろえる`,
    },
    {
      id: "use-once",
      label: `1から${maxValue}までの数を1回ずつ使う`,
    },
  ],
  steps,
  freePlay: {
    headline: "残りも空きが1つの列から",
    detail: "マスを選んで、足りない数を押します。",
  },
  completion: {
    home: {
      headline: "完成です",
      detail: `どの列も合計${magicSum}にそろいました。`,
    },
    play: {
      headline: "完成です",
      detail: "プレイに戻って、続きを解きます。",
    },
  },
  start: createStartState,
  goal() {
    return {
      puzzleState: {
        ...createStartState().puzzleState,
        cells: tutorialSolution.cells,
      },
      selectedCellIndex: null,
    };
  },
  perform(situation, state, action) {
    return situation.step
      ? performGuided(situation.step, state, action)
      : performFree(state, action);
  },
  describeViolation(): TutorialMessage {
    return {
      headline: "合計の合わない列があります",
      detail: "赤い数の列を見直します。同じ数をもう一度押すと外せます。",
    };
  },
};
