import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
  type ReflectionBoard,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  isSameReflectionEntry,
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionStock,
  type ReflectionSelection,
  type ReflectionSession,
  removeReflectionSessionPiece,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
} from "@/games/reflection/session/session";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type ReflectionTutorialRuleId =
  | "number"
  | "black-hole"
  | "mirror"
  | "reflector"
  | "double";

export type ReflectionTutorialAction =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry }
  | { type: "remove"; cellIndex: number }
  | { type: "clear-selection" };

/**
 * 手を引く1手順。
 * - `light`: 印の外周ヒントを押させ、その光の道筋を出す。
 * - `place`: 印の種類をストックで選ばせ、印のマスに置かせる。手順の間、`entry` から入れた今の光を見せ続ける。
 * - `entry`: 押させる外周ヒント、または置く場所を決める外周ヒント。
 * - `reasonEntries`: その手を決める外周ヒント（決め手）。光を出す手順では、押させる所が決まる光の外周ヒント。
 * - `resultEntry`: 置いた後に光を見せる外周ヒント。一言が置いた結果として示すものに合わせる。
 */
export type ReflectionTutorialStep = TutorialStep<ReflectionTutorialRuleId> & {
  entry: ReflectionEntry;
  reasonEntries: readonly ReflectionEntry[];
} & (
    | { type: "light" }
    | {
        type: "place";
        piece: ReflectionPiece;
        cellIndex: number;
        resultEntry: ReflectionEntry;
      }
  );

/**
 * 直前の手。盤面の上の合図に使う。
 * - `fittedCellIndex`: この手で手順どおりに置いたマス。
 * - `litEntry`: この手で手順を終えたときに光を見せる外周ヒント。次の手まで、その外周ヒントから入れた今の光を見せ、手の結果を盤面で返す。
 * - `piecePlaced`: この手でピースが盤面に現れた（置いた・移した・入れ替えた・置き換えた）。本番と同じく、置いた音を鳴らすのに使う。
 */
export type ReflectionTutorialMove = {
  fittedCellIndex: number | null;
  litEntry: ReflectionEntry | null;
  piecePlaced: boolean;
};

/**
 * 本番と同じ操作で盤面を進めるため、本番の1回のプレイ（`ReflectionSession`）をそのまま持つ。経過時間や回数は使わない。
 * `moveCount` は盤面かどこを選んでいるかを変えた手の数。同じ所への合図をやり直す目印に使う。
 */
export type ReflectionTutorialBoardState = {
  session: ReflectionSession;
  moveCount: number;
  lastMove: ReflectionTutorialMove | null;
};

export type ReflectionTutorialTarget =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry };

type ReflectionTutorialSituation = TutorialSituation<
  ReflectionTutorialRuleId,
  ReflectionTutorialStep
>;

type ReflectionTutorialPlacement = {
  piece: ReflectionPiece;
  cellIndex: number;
  reasonEntries: readonly ReflectionEntry[];
};

const SIZE = 5;

function cellAt(oneBasedRow: number, oneBasedColumn: number): number {
  return (oneBasedRow - 1) * SIZE + (oneBasedColumn - 1);
}

/**
 * ```text
 *       5•  5↗  3•  3↩  9↩
 *  5↗   .   .   .   .   .    5↗
 *  5↗   .   .   .   =   .    5↗
 *  3↗   \   .   @   .   .    3•
 *  7↩   .   .   .   o   /    2↗
 *  1↩   |   .   .   .   .    9↩
 *       3↗  5↗  3•  3↩  2↗
 * ```
 * （↗ 退出、↩ 反射、• 吸収）
 */
const solution: ReflectionBoard = parseReflectionBoard([
  ".....",
  "...=.",
  "\\.@..",
  "...o/",
  "|....",
]);

const problem: ReflectionProblem = {
  size: SIZE,
  inventory: countReflectionBoardPieces(solution),
  clues: computeReflectionClues(solution),
  solution,
};

/** 最初に、何も置いていない盤面でまっすぐ抜ける光を出す。この光は後で両面鏡に沿って通る。 */
const steps: readonly ReflectionTutorialStep[] = [
  {
    type: "light",
    message: {
      headline: "数字は光が通るマスの数です",
      detail: "数字を押すと光が見えます",
    },
    introducedRuleId: "number",
    entry: { side: "left", index: 1 },
    reasonEntries: [],
  },
  {
    type: "light",
    message: {
      headline: "光が出た先にも同じ数字があります",
      detail: "出た先の数字が違うと緑になりません",
    },
    introducedRuleId: "number",
    entry: { side: "right", index: 1 },
    reasonEntries: [{ side: "left", index: 1 }],
  },
  {
    type: "place",
    message: {
      headline: "ブラックホールは光を吸い込みます",
      detail: "点の付いた3は\n光が3マス目で吸い込まれます",
    },
    introducedRuleId: "black-hole",
    piece: "black-hole",
    cellIndex: cellAt(3, 3),
    entry: { side: "top", index: 2 },
    reasonEntries: [{ side: "top", index: 2 }],
    resultEntry: { side: "top", index: 2 },
  },
  {
    type: "place",
    message: {
      headline: "斜め鏡は光を直角に曲げます",
      detail: "斜めの矢印の2は\n光が2マス通って外へ出ます",
    },
    introducedRuleId: "mirror",
    piece: "slash",
    cellIndex: cellAt(4, 5),
    entry: { side: "bottom", index: 4 },
    reasonEntries: [
      { side: "bottom", index: 4 },
      { side: "right", index: 3 },
    ],
    resultEntry: { side: "bottom", index: 4 },
  },
  {
    type: "place",
    message: {
      headline: "反射体は光をはね返します",
      detail: "折り返す矢印の3は\n光が戻る1マスも数に入ります",
    },
    introducedRuleId: "reflector",
    piece: "reflector",
    cellIndex: cellAt(4, 4),
    entry: { side: "bottom", index: 3 },
    reasonEntries: [{ side: "bottom", index: 3 }],
    resultEntry: { side: "bottom", index: 3 },
  },
  {
    type: "place",
    message: {
      headline: "両面鏡は当たる光をはね返し\n鏡に沿う光は通します",
      detail: "折り返す矢印の3は2マス目ではね返ります",
    },
    introducedRuleId: "double",
    piece: "horizontal-double",
    cellIndex: cellAt(2, 4),
    entry: { side: "top", index: 3 },
    reasonEntries: [{ side: "top", index: 3 }],
    resultEntry: { side: "left", index: 1 },
  },
];

/** 手を離した後に自分で置くピース。 */
const freePlacements: readonly ReflectionTutorialPlacement[] = [
  {
    piece: "backslash",
    cellIndex: cellAt(3, 1),
    reasonEntries: [
      { side: "left", index: 2 },
      { side: "bottom", index: 0 },
    ],
  },
  {
    piece: "vertical-double",
    cellIndex: cellAt(5, 1),
    reasonEntries: [{ side: "left", index: 4 }],
  },
];

/** 正解の配置を、手がかりで示す順に並べる。手を引いた手順の配置を先にする。 */
const placements: readonly ReflectionTutorialPlacement[] = [
  ...steps.flatMap((step): ReflectionTutorialPlacement[] =>
    step.type === "place"
      ? [
          {
            piece: step.piece,
            cellIndex: step.cellIndex,
            reasonEntries: step.reasonEntries,
          },
        ]
      : [],
  ),
  ...freePlacements,
];

function isSameSelection(
  selection: ReflectionSelection | null,
  piece: ReflectionPiece,
): boolean {
  return selection?.type === "stock" && selection.piece === piece;
}

function applyAction(
  session: ReflectionSession,
  action: ReflectionTutorialAction,
): ReflectionSession {
  switch (action.type) {
    case "stock":
      return tapReflectionSessionStock(session, action.piece, 0);
    case "cell":
      return tapReflectionSessionCell(session, action.cellIndex, 0);
    case "clue":
      return tapReflectionSessionClue(session, action.entry);
    case "remove":
      return removeReflectionSessionPiece(session, action.cellIndex, 0);
    case "clear-selection":
      return clearReflectionSessionSelection(session);
  }
}

function fitsStep(
  step: ReflectionTutorialStep,
  session: ReflectionSession,
  action: ReflectionTutorialAction,
): boolean {
  if (step.type === "light") {
    return (
      action.type === "clue" &&
      isSameReflectionEntry(action.entry, step.entry) &&
      (session.laserEntry === null ||
        !isSameReflectionEntry(session.laserEntry, step.entry))
    );
  }
  const selected = isSameSelection(session.selection, step.piece);
  switch (action.type) {
    case "stock":
      return action.piece === step.piece && !selected;
    case "cell":
      return action.cellIndex === step.cellIndex && selected;
    case "clear-selection":
      return selected;
    default:
      return false;
  }
}

function isStepDone(
  step: ReflectionTutorialStep,
  session: ReflectionSession,
): boolean {
  if (step.type === "light") {
    return (
      session.laserEntry !== null &&
      isSameReflectionEntry(session.laserEntry, step.entry)
    );
  }
  return session.puzzleState.cells[step.cellIndex] === step.piece;
}

function countPlacedPieces(session: ReflectionSession): number {
  return session.puzzleState.cells.filter((cell) => cell !== null).length;
}

/** 本番のプレイと同じく、盤面が変わり、置いたピースが減っていない手を、ピースを置いた手とする。 */
function isPiecePlaced(
  before: ReflectionSession,
  after: ReflectionSession,
): boolean {
  return (
    after.puzzleState !== before.puzzleState &&
    countPlacedPieces(after) >= countPlacedPieces(before)
  );
}

function startReflectionTutorial(): ReflectionTutorialBoardState {
  return {
    session: createReflectionSession(problem, 0),
    moveCount: 0,
    lastMove: null,
  };
}

function getReflectionTutorialGoal(): ReflectionTutorialBoardState {
  const session = createReflectionSession(problem, 0);
  return {
    session: {
      ...session,
      puzzleState: solution,
      status: "cleared",
      clearedAt: 0,
    },
    moveCount: 0,
    lastMove: null,
  };
}

function performReflectionTutorialAction(
  { step }: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
  action: ReflectionTutorialAction,
): {
  state: ReflectionTutorialBoardState;
  outcome: TutorialMoveOutcome;
} {
  if (step !== null && !fitsStep(step, state.session, action)) {
    return { state, outcome: "ignored" };
  }
  const session = applyAction(state.session, action);
  if (session === state.session) {
    return { state, outcome: "ignored" };
  }

  const stepped = step !== null && isStepDone(step, session);
  const litEntry = !stepped
    ? null
    : step.type === "place"
      ? step.resultEntry
      : step.entry;
  // 結果として見せる光は、本番でその外周ヒントを押したのと同じに扱い、押すと閉じるようにする。
  const next: ReflectionTutorialBoardState = {
    session: litEntry === null ? session : { ...session, laserEntry: litEntry },
    moveCount: state.moveCount + 1,
    lastMove: {
      fittedCellIndex: stepped && step.type === "place" ? step.cellIndex : null,
      litEntry,
      piecePlaced: isPiecePlaced(state.session, session),
    },
  };
  if (session.status === "cleared") {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: stepped ? "stepped" : "continued" };
}

const freePlay: TutorialMessage = {
  headline: "すべての数字が緑になれば完成です",
  detail: null,
};

/** 合わない配置でも止めないので、ルールに合わない手は無い。 */
function describeReflectionTutorialViolation(): TutorialMessage {
  return freePlay;
}

export function getReflectionTutorialLaserEntry(
  { step }: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
): ReflectionEntry | null {
  if (step === null) {
    return state.session.laserEntry;
  }
  if (state.lastMove?.litEntry) {
    return state.lastMove.litEntry;
  }
  return step.type === "place" ? step.entry : null;
}

export function getReflectionTutorialStepTarget(
  { step }: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
): ReflectionTutorialTarget | null {
  if (step === null) {
    return null;
  }
  if (step.type === "light") {
    return { type: "clue", entry: step.entry };
  }
  return isSameSelection(state.session.selection, step.piece)
    ? { type: "cell", cellIndex: step.cellIndex }
    : { type: "stock", piece: step.piece };
}

export function listReflectionTutorialSpotlitTargets(
  situation: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
): ReflectionTutorialTarget[] {
  const { step } = situation;
  if (step === null) {
    return [];
  }
  const target = getReflectionTutorialStepTarget(situation, state);
  const laserEntry = getReflectionTutorialLaserEntry(situation, state);
  // 前の手順の結果として残している光は、一言が次の手順に替わっているので抜かない。
  const reasonLaserEntry =
    laserEntry !== null &&
    step.reasonEntries.some((entry) => isSameReflectionEntry(entry, laserEntry))
      ? laserEntry
      : null;
  const litCellIndices =
    reasonLaserEntry === null
      ? []
      : traceReflectionLaser(
          state.session.puzzleState,
          reasonLaserEntry,
        ).path.map((laserStep) => laserStep.cellIndex);
  const targets: ReflectionTutorialTarget[] = [
    ...(target === null ? [] : [target]),
    ...step.reasonEntries.map(
      (entry): ReflectionTutorialTarget => ({ type: "clue", entry }),
    ),
    ...litCellIndices.map(
      (cellIndex): ReflectionTutorialTarget => ({ type: "cell", cellIndex }),
    ),
  ];
  return targets.filter(
    (candidate, index) =>
      targets.findIndex((other) => isSameTarget(other, candidate)) === index,
  );
}

function isSameTarget(
  left: ReflectionTutorialTarget,
  right: ReflectionTutorialTarget,
): boolean {
  switch (left.type) {
    case "stock":
      return right.type === "stock" && left.piece === right.piece;
    case "cell":
      return right.type === "cell" && left.cellIndex === right.cellIndex;
    case "clue":
      return (
        right.type === "clue" && isSameReflectionEntry(left.entry, right.entry)
      );
  }
}

function findUnselectedHintTarget(
  session: ReflectionSession,
): ReflectionTutorialTarget | null {
  const { cells } = session.puzzleState;
  const stock = getReflectionSessionStock(session);
  const placeable = placements.find(
    (placement) =>
      cells[placement.cellIndex] === null && stock[placement.piece] > 0,
  );
  if (placeable) {
    return { type: "stock", piece: placeable.piece };
  }
  const mistakenCellIndex = cells.findIndex(
    (cell, cellIndex) => cell !== null && solution.cells[cellIndex] !== cell,
  );
  return mistakenCellIndex >= 0
    ? { type: "cell", cellIndex: mistakenCellIndex }
    : null;
}

/**
 * - ストックの種類を選んでいる: その種類の正解のマスが空いていればそこを、ふさがれていれば選んだ種類を押して選ぶのをやめさせる。
 * - 盤面のピースを選んでいる: 示すピースがそれなら、その正解のマスを示す。そうでなければ、押して選ぶのをやめさせる。
 * - 何も選んでいない: ストックの種類か、示すピースを選ばせる。
 */
export function findReflectionTutorialHint(
  state: ReflectionTutorialBoardState,
): ReflectionTutorialTarget | null {
  const { session } = state;
  const { puzzleState: board, selection } = session;
  if (selection?.type === "stock") {
    const placement = placements.find(
      (candidate) => candidate.piece === selection.piece,
    );
    return placement && board.cells[placement.cellIndex] === null
      ? { type: "cell", cellIndex: placement.cellIndex }
      : { type: "stock", piece: selection.piece };
  }
  const unselected = findUnselectedHintTarget({ ...session, selection: null });
  if (selection?.type !== "cell") {
    return unselected;
  }
  const mistaken =
    unselected?.type === "cell" && unselected.cellIndex === selection.cellIndex;
  const piece = board.cells[selection.cellIndex] ?? null;
  const placement = mistaken
    ? placements.find((candidate) => candidate.piece === piece)
    : undefined;
  return placement
    ? { type: "cell", cellIndex: placement.cellIndex }
    : { type: "cell", cellIndex: selection.cellIndex };
}

export const reflectionTutorial: Tutorial<
  ReflectionTutorialRuleId,
  ReflectionTutorialStep,
  ReflectionTutorialBoardState,
  ReflectionTutorialAction
> = {
  intro: {
    purpose: "外周の数字どおりに光が進むよう\nピースを盤面に置くパズルです",
    goalCaption: "この盤面がゴールです",
    startCaption: "最初は盤面が空です\n合っている数字は緑です",
  },
  rules: [
    { id: "number", label: "数字" },
    { id: "black-hole", label: "ブラックホール" },
    { id: "mirror", label: "斜め鏡" },
    { id: "reflector", label: "反射体" },
    { id: "double", label: "両面鏡" },
  ],
  steps,
  freePlay,
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも同じルールです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
    },
  },
  start: startReflectionTutorial,
  goal: getReflectionTutorialGoal,
  perform: performReflectionTutorialAction,
  describeViolation: describeReflectionTutorialViolation,
};

export const _private = {
  solution,
  steps,
  placements,
  freePlacements,
  cellAt,
};
