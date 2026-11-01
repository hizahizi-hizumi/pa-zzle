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
} from "@/games/reflection/puzzle/laser";
import {
  clearReflectionSessionSelection,
  createReflectionSession,
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

/**
 * - `number`: 数字は、そこから入れた光が通るマスの数。
 * - `black-hole`: ブラックホールは光を吸い込む。
 * - `mirror`: 斜め鏡は光を直角に曲げる。
 * - `reflector`: 反射体は光をはね返す。戻る道のマスも数える。
 * - `double`: 両面鏡は、当たる光をはね返し、沿う光は通す。
 */
export type ReflectionTutorialRuleId =
  | "number"
  | "black-hole"
  | "mirror"
  | "reflector"
  | "double";

/** 本番と同じく、ストックの種類・盤面のマス・外周ヒントを押す。キーボードでは、ピースを戻すことと選択の解除もできる。 */
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
 * - `reasonEntries`: 置く場所を決める外周ヒント。手順の始まりから示し、どの数字で決まるかを盤面で分からせる。
 * - `resultEntry`: 置いた後に光を見せる外周ヒント。一言が置いた結果として示すものに合わせる。
 */
export type ReflectionTutorialStep = TutorialStep<ReflectionTutorialRuleId> &
  (
    | { type: "light"; entry: ReflectionEntry }
    | {
        type: "place";
        piece: ReflectionPiece;
        cellIndex: number;
        entry: ReflectionEntry;
        reasonEntries: readonly ReflectionEntry[];
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

/** 次に押す所。ストックの種類、盤面のマス、外周ヒントのどれか。 */
export type ReflectionTutorialTarget =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry };

/**
 * 手を離した後、手が止まったときに示す次の手。
 * - `target`: 次に押す所。
 * - `reasonEntries`: そこに置くピースを決める外周ヒント。決め手の無い手（間違えて置いたピースを選ぶなど）では空。
 */
export type ReflectionTutorialHint = {
  target: ReflectionTutorialTarget;
  reasonEntries: readonly ReflectionEntry[];
};

type ReflectionTutorialSituation = TutorialSituation<
  ReflectionTutorialRuleId,
  ReflectionTutorialStep
>;

/** 正解の配置の1つと、そこに置くピースを決める外周ヒント。 */
type ReflectionTutorialPlacement = {
  piece: ReflectionPiece;
  cellIndex: number;
  reasonEntries: readonly ReflectionEntry[];
};

const SIZE = 5;

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * SIZE + (column - 1);
}

/**
 * 5×5 に、6種類のピースを1つずつ置く。手を引く間に4種類の働きを1つずつ置いて確かめ、
 * 残りの2つ（向きの違う斜め鏡と両面鏡）は、同じ働きを当てはめて自分で置く。
 *
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

/**
 * 最初に、何も置いていない盤面でまっすぐ抜ける光を出して数字の意味を見せる。この光は後で両面鏡に沿って通る。
 * 置く手順は、どれもその外周ヒント1本と、そこまでに置いたピースだけで、置く場所が1つに決まる。
 */
const steps: readonly ReflectionTutorialStep[] = [
  {
    type: "light",
    message: {
      headline: "数字は、光が通るマスの数。\n下の記号は、光の行き先です",
      detail: "印の数字を押して、光を出してください",
    },
    introducedRuleId: "number",
    entry: { side: "left", index: 1 },
  },
  {
    type: "place",
    message: {
      headline: "ブラックホールは光を吸い込みます",
      detail:
        "この3は、3マス目で吸い込まれる光です\n選んで、印のマスに置いてください",
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
      headline: "斜め鏡は、光を直角に曲げます",
      detail: "この2は、2マス目で曲がって\nもう1つの2から出る光です",
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
      headline: "反射体は、光をはね返します。\n戻る道のマスも数えます",
      detail: "この3は、2マス目ではね返る光です",
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
      headline: "両面鏡は、当たる光をはね返し\n沿う光は通します",
      detail: "最初に出した光は、そのまま通ります",
    },
    introducedRuleId: "double",
    piece: "horizontal-double",
    cellIndex: cellAt(2, 4),
    entry: { side: "top", index: 3 },
    reasonEntries: [
      { side: "top", index: 3 },
      { side: "left", index: 1 },
    ],
    resultEntry: { side: "left", index: 1 },
  },
];

/** 手を離した後に自分で置くピース。どれも外周ヒント1本で、置く場所と種類が決まる。 */
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

/**
 * 手を引いている間の手が、手順どおりか。
 * 光を出す手順では、印の外周ヒントを押す手だけを受け付ける。
 * 置く手順では、印の種類を選ぶ手と、その種類を選んでから印のマスを押す手と、選んだ種類を解除する手だけを受け付ける。
 */
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

/** 解き終えた盤面。手持ちのピースはすべて置いてある。 */
function getReflectionTutorialGoal(): ReflectionTutorialBoardState {
  const session = createReflectionSession(problem, 0);
  return {
    session: {
      ...session,
      puzzleState: solution,
      status: "cleared",
      finishedAt: 0,
    },
    moveCount: 0,
    lastMove: null,
  };
}

/**
 * 手を引いている間は、手順どおりの手だけを受け付ける。
 * 手を離した後は本番と同じく、置く・移す・入れ替える・戻す・光を出すのどれもでき、合わない配置でも止めない。
 */
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
  headline: "残りのピースも置いて\nすべての数字を緑にすると完成です",
  detail: "数字を押すと、今の光が見えます",
};

/** 合わない配置でも止めないので、ルールに合わない手は無い。 */
function describeReflectionTutorialViolation(): TutorialMessage {
  return freePlay;
}

/**
 * 盤面に見せる光の入口。
 * 手を引く間は、手順を終えた手の直後はその結果の光を見せ、置く手順の間は置く場所を決める外周ヒントの今の光を見せる。
 * 手を離した後は本番と同じく、押した外周ヒントの光を見せる。手を離した直後は、最後の手順の結果の光を押したものとして見せる。
 */
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

/**
 * 手順で印を付ける所。光を出す手順は外周ヒント、置く手順は種類を選ぶまでストック、選んだ後はマス。手を離した後は `null`。
 */
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

/**
 * 手を離した後、手が止まったときに示す次の手。正解の配置へ向けて、本番の操作で1手ずつ進める。
 * - 盤面のピースを選んでいる: 正しい所にあるなら押して選ぶのをやめさせ、違う所にあるなら、そのピースが入る所を示す。
 * - ストックの種類を選んでいる: その種類が入る所を示す。
 * - 何も選んでいない: 違う所に置いたピースがあればそれを選ばせ、無ければ次に置くピースの種類を示す。
 * 揃っていれば `null`。
 */
export function findReflectionTutorialHint(
  state: ReflectionTutorialBoardState,
): ReflectionTutorialHint | null {
  const { puzzleState: board, selection } = state.session;
  const missing = placements.filter(
    (placement) => board.cells[placement.cellIndex] !== placement.piece,
  );
  function findMissing(piece: ReflectionPiece) {
    return missing.find((placement) => placement.piece === piece);
  }

  if (selection?.type === "cell") {
    const piece = board.cells[selection.cellIndex] ?? null;
    if (piece === null || solution.cells[selection.cellIndex] === piece) {
      return {
        target: { type: "cell", cellIndex: selection.cellIndex },
        reasonEntries: [],
      };
    }
    const placement = findMissing(piece);
    return placement
      ? {
          target: { type: "cell", cellIndex: placement.cellIndex },
          reasonEntries: placement.reasonEntries,
        }
      : null;
  }
  if (selection?.type === "stock") {
    const placement = findMissing(selection.piece);
    return placement
      ? {
          target: { type: "cell", cellIndex: placement.cellIndex },
          reasonEntries: placement.reasonEntries,
        }
      : null;
  }

  const misplacedCellIndex = board.cells.findIndex(
    (cell, cellIndex) => cell !== null && solution.cells[cellIndex] !== cell,
  );
  if (misplacedCellIndex >= 0) {
    return {
      target: { type: "cell", cellIndex: misplacedCellIndex },
      reasonEntries: [],
    };
  }
  const next = missing[0];
  return next
    ? {
        target: { type: "stock", piece: next.piece },
        reasonEntries: next.reasonEntries,
      }
    : null;
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
    startCaption: "最初は盤面が空です。\n数字どおりに光が進む所は緑です",
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
    selection: {
      headline: "完成です",
      detail: "レベル1も 5×5 の盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールで解けます",
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
