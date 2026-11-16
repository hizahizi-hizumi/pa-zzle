import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
  type ReflectionBoard,
  type ReflectionCell,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  getReflectionEntryIndex,
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import {
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionStock,
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
  | "black-hole"
  | "number"
  | "mirror"
  | "reflector"
  | "double";

export type ReflectionTutorialAction =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry }
  | { type: "remove"; cellIndex: number }
  | { type: "clear-selection" };

/** 手順で、プレイヤーが自分で選ぶもの。`none` は操作を教える手順。 */
export type ReflectionTutorialChoice = "none" | "cell" | "piece" | "both";

/**
 * 1つのピースを置かせる手順。
 * - `piece` / `cellIndex`: 置くピースとマス。解と同じ。
 * - `reasonEntries`: 置く物を決める外周ヒント（決め手）。手順の間、最初の外周ヒントから入れた今の光を見せ続ける。
 * - `resultEntry`: 置いた後に光を見せる外周ヒント。
 * - `midwayMessage`: 印のピースを選んだ後の一言。操作を教える手順だけが持つ。
 * - `namedPieces`: 一言で名前を言うピース。
 */
export type ReflectionTutorialStep = TutorialStep<ReflectionTutorialRuleId> & {
  piece: ReflectionPiece;
  cellIndex: number;
  choice: ReflectionTutorialChoice;
  namedPieces: readonly ReflectionPiece[];
  reasonEntries: readonly ReflectionEntry[];
  resultEntry: ReflectionEntry;
  midwayMessage: TutorialMessage | null;
};

export type ReflectionTutorialMove = {
  fittedCellIndex: number | null;
  /** この手で手順を終えたときに光を見せる外周ヒント。次の手まで、その外周ヒントから入れた今の光を見せる。 */
  litEntry: ReflectionEntry | null;
  /** 置いた・移した・入れ替えた・置き換えたのどれでも真。本番と同じく、置いた音を鳴らすのに使う。 */
  piecePlaced: boolean;
};

/** 本番と同じ操作で盤面を進めるため、本番の1回のプレイをそのまま持つ。経過時間や回数は使わない。 */
export type ReflectionTutorialBoardState = {
  session: ReflectionSession;
  /** 盤面かどこを選んでいるかを変えた手の数。同じ所への合図をやり直す目印に使う。 */
  moveCount: number;
  lastMove: ReflectionTutorialMove | null;
};

export type ReflectionTutorialTarget =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number };

export type ReflectionTutorialMark = {
  target: ReflectionTutorialTarget;
  /** 輪郭に加えて指で指す。 */
  pointed: boolean;
};

/** どちらも空なら盤面を覆わない。 */
export type ReflectionTutorialSpotlight = {
  entries: readonly ReflectionEntry[];
  cellIndices: readonly number[];
};

export type ReflectionTutorialHint = {
  target: ReflectionTutorialTarget;
  /** 解と違う所に置いたピースを示すときは空。 */
  reasonEntries: readonly ReflectionEntry[];
  message: TutorialMessage;
};

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

/** 1始まりの位置で書いた外周ヒント。上下の辺は左からの列、左右の辺は上からの行。 */
function entryAt(
  side: ReflectionEntry["side"],
  position: number,
): ReflectionEntry {
  return { side, index: position - 1 };
}

/**
 * ```text
 *       2•  4↗  5↗  5↩  1↩
 *  5•   .   \   .   .   =    4↗
 *  1•   @   .   .   .   .    5•
 *  5↗   .   .   /   o   .    3↩
 *  2•   .   @   .   .   @    1•
 *  2↗   .   \   .   .   .    5•
 *       4•  2↗  7↩  5↩  2•
 * ```
 * （↗ 退出、↩ 反射、• 吸収）
 */
const solution: ReflectionBoard = parseReflectionBoard([
  ".\\..=",
  "@....",
  "../o.",
  ".@..@",
  ".\\...",
]);

const problem: ReflectionProblem = {
  size: SIZE,
  inventory: countReflectionBoardPieces(solution),
  clues: computeReflectionClues(solution),
  solution,
};

const steps: readonly ReflectionTutorialStep[] = [
  {
    message: {
      headline: "置くピースをタップして選択します",
      detail: "ブラックホールは\n光を止めます",
    },
    midwayMessage: {
      headline: "印のマスをタップして置きます",
      detail: null,
    },
    introducedRuleId: "black-hole",
    piece: "black-hole",
    cellIndex: cellAt(4, 5),
    choice: "none",
    namedPieces: ["black-hole"],
    reasonEntries: [],
    resultEntry: entryAt("bottom", 5),
  },
  {
    message: {
      headline: "光が通るマスの数が\n書かれています",
      detail:
        "光が吸い込まれる数字には点が付いています\n下の4の光を4マス目で止めます",
    },
    midwayMessage: null,
    introducedRuleId: "number",
    piece: "black-hole",
    cellIndex: cellAt(2, 1),
    choice: "cell",
    namedPieces: [],
    reasonEntries: [entryAt("bottom", 1)],
    resultEntry: entryAt("bottom", 1),
  },
  {
    message: {
      headline:
        "斜め鏡は光を直角に曲げます\n光が出ていく数字には斜めの矢印が付いています",
      detail:
        "光が入る所と出る所には同じ数字があります\n上の4の光を右の4から出します",
    },
    midwayMessage: null,
    introducedRuleId: "mirror",
    piece: "backslash",
    cellIndex: cellAt(1, 2),
    choice: "both",
    namedPieces: ["slash", "backslash"],
    reasonEntries: [entryAt("top", 2), entryAt("right", 1)],
    resultEntry: entryAt("top", 2),
  },
  {
    message: {
      headline:
        "反射鏡は光をはね返します\n光が戻る数字には折り返す矢印が付いています",
      detail: "上の5の光が行きと戻りを合わせて5マスで戻るように置きます",
    },
    midwayMessage: null,
    introducedRuleId: "reflector",
    piece: "reflector",
    cellIndex: cellAt(3, 4),
    choice: "cell",
    namedPieces: ["reflector"],
    reasonEntries: [entryAt("top", 4)],
    resultEntry: entryAt("top", 4),
  },
  {
    message: {
      headline: "両面鏡は当たる光をはね返し\n沿って進む光は通します",
      detail: "上の1の光が戻り\n右の4の光が通るように置きます",
    },
    midwayMessage: null,
    introducedRuleId: "double",
    piece: "horizontal-double",
    cellIndex: cellAt(1, 5),
    choice: "piece",
    namedPieces: ["horizontal-double"],
    reasonEntries: [entryAt("top", 5), entryAt("right", 1)],
    resultEntry: entryAt("top", 5),
  },
  {
    message: {
      headline: "数字1つから置く場所とピースを決めます",
      detail: "左の真ん中の5の光が\n5マスで上へ出るように置きます",
    },
    midwayMessage: null,
    introducedRuleId: null,
    piece: "slash",
    cellIndex: cellAt(3, 3),
    choice: "both",
    namedPieces: [],
    reasonEntries: [entryAt("left", 3), entryAt("top", 3)],
    resultEntry: entryAt("left", 3),
  },
];

const freePlacements: readonly ReflectionTutorialPlacement[] = [
  {
    piece: "black-hole",
    cellIndex: cellAt(4, 2),
    reasonEntries: [entryAt("left", 4)],
  },
  {
    piece: "backslash",
    cellIndex: cellAt(5, 2),
    reasonEntries: [entryAt("left", 5), entryAt("bottom", 2)],
  },
];

/** 手がかりで示す順に並べる。 */
const placements: readonly ReflectionTutorialPlacement[] = [
  ...steps.map(({ piece, cellIndex, reasonEntries }) => ({
    piece,
    cellIndex,
    reasonEntries,
  })),
  ...freePlacements,
];

const doubleRuleMessage: TutorialMessage = {
  headline: "両面鏡は当たる光をはね返し\n沿って進む光は通します",
  detail: null,
};

const pieceRuleMessages = {
  "black-hole": {
    headline: "ブラックホールは\n光を止めます",
    detail: null,
  },
  slash: { headline: "斜め鏡は光を直角に曲げます", detail: null },
  backslash: { headline: "斜め鏡は光を直角に曲げます", detail: null },
  reflector: { headline: "反射鏡は光をはね返します", detail: null },
  "vertical-double": doubleRuleMessage,
  "horizontal-double": doubleRuleMessage,
} as const satisfies Record<ReflectionPiece, TutorialMessage>;

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

/** 手順を始めたときの盤面。それまでの手順のピースだけが置いてある。 */
function getStepStartBoard(step: ReflectionTutorialStep): ReflectionBoard {
  const cells: ReflectionCell[] = Array.from(
    { length: SIZE * SIZE },
    () => null,
  );
  for (const earlier of steps.slice(0, steps.indexOf(step))) {
    cells[earlier.cellIndex] = earlier.piece;
  }
  return { size: SIZE, cells };
}

function listChangedCellIndices(
  step: ReflectionTutorialStep,
  board: ReflectionBoard,
): number[] {
  const start = getStepStartBoard(step);
  return board.cells.flatMap((cell, index) =>
    cell === start.cells[index] ? [] : [index],
  );
}

function findStepPlacedCellIndex(
  step: ReflectionTutorialStep,
  board: ReflectionBoard,
): number | null {
  // 手順の中で置ける物は1つなので、変わったマスはこの手順で置いたピースのマスになる。
  return listChangedCellIndices(step, board)[0] ?? null;
}

function choosesCell(step: ReflectionTutorialStep): boolean {
  return step.choice === "cell" || step.choice === "both";
}

function choosesPiece(step: ReflectionTutorialStep): boolean {
  return step.choice === "piece" || step.choice === "both";
}

/** 手順を始めたときの盤面の空きマスに、選べるピースを1つ置いただけの盤面と、選べるピースかこの手順で置いたピースの選択に限る。 */
function isWithinStep(
  step: ReflectionTutorialStep,
  session: ReflectionSession,
): boolean {
  const { cells } = session.puzzleState;
  const changed = listChangedCellIndices(step, session.puzzleState);
  if (changed.length > 1) {
    return false;
  }
  const [placedCellIndex] = changed;
  if (placedCellIndex !== undefined) {
    const placed = cells[placedCellIndex] ?? null;
    const placedOnEmpty =
      getStepStartBoard(step).cells[placedCellIndex] === null;
    const allowedCell = choosesCell(step) || placedCellIndex === step.cellIndex;
    const allowedPiece = choosesPiece(step) || placed === step.piece;
    if (placed === null || !placedOnEmpty || !allowedCell || !allowedPiece) {
      return false;
    }
  }
  const { selection } = session;
  switch (selection?.type) {
    case undefined:
      return true;
    case "stock":
      return choosesPiece(step) || selection.piece === step.piece;
    case "cell":
      return selection.cellIndex === placedCellIndex;
  }
}

function isStepDone(
  step: ReflectionTutorialStep,
  session: ReflectionSession,
): boolean {
  const changed = listChangedCellIndices(step, session.puzzleState);
  return (
    changed.length === 1 &&
    changed[0] === step.cellIndex &&
    session.puzzleState.cells[step.cellIndex] === step.piece
  );
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

function isStockEmpty(session: ReflectionSession): boolean {
  return Object.values(getReflectionSessionStock(session)).every(
    (count) => count === 0,
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
  if (step !== null && action.type === "clue") {
    return { state, outcome: "ignored" };
  }
  const session = applyAction(state.session, action);
  if (
    session === state.session ||
    (step !== null && !isWithinStep(step, session))
  ) {
    return { state, outcome: "ignored" };
  }

  const stepped = step !== null && isStepDone(step, session);
  const litEntry = stepped ? step.resultEntry : null;
  // 結果として見せる光は、本番でその外周ヒントを押したのと同じに扱い、押すと閉じるようにする。
  const next: ReflectionTutorialBoardState = {
    session: litEntry === null ? session : { ...session, laserEntry: litEntry },
    moveCount: state.moveCount + 1,
    lastMove: {
      fittedCellIndex: stepped ? step.cellIndex : null,
      litEntry,
      piecePlaced: isPiecePlaced(state.session, session),
    },
  };
  if (session.status === "cleared") {
    return { state: next, outcome: "solved" };
  }
  if (stepped) {
    return { state: next, outcome: "stepped" };
  }
  const misplaced =
    step !== null &&
    findStepPlacedCellIndex(step, session.puzzleState) !== null;
  return { state: next, outcome: misplaced ? "violated" : "continued" };
}

// 違反のときにだけ使うので、合っている光は言わない。
function describeLight(board: ReflectionBoard, entry: ReflectionEntry): string {
  const trace = traceReflectionLaser(board, entry);
  const { outcome, distance } = trace;
  // 数字どおりのマス数で出ても、出た先の数字が違えば合わない。数を言うだけでは何が違うか分からないので、出た先のことを言う。
  const clueIndex = getReflectionEntryIndex(SIZE, entry);
  const clue = problem.clues[clueIndex];
  const matched = listReflectionClueMatches(board, problem.clues)[clueIndex];
  if (
    !matched &&
    outcome === "exit" &&
    clue?.outcome === "exit" &&
    clue.distance === distance
  ) {
    return "光が出た先の数字と合っていません";
  }
  switch (outcome) {
    case "absorb":
      return `光が${distance}マス目で止まります`;
    case "reflect":
      return `光が${distance}マス通って戻ります`;
    case "exit":
      return `光が${distance}マス通って出ます`;
  }
}

const fixDetails = {
  cell: {
    unselected: "置いたピースをタップしてから\n別のマスをタップします",
    selected: "別のマスをタップして動かします",
  },
  piece: {
    unselected: "置いたピースをタップしてから\n別のピースをタップします",
    selected: "別のピースをタップして置き換えます",
  },
  both: {
    unselected: "置いたピースをタップしてから\n別のマスかピースをタップします",
    selected: "別のマスかピースをタップして置き直します",
  },
} as const satisfies Record<
  Exclude<ReflectionTutorialChoice, "none">,
  Record<"unselected" | "selected", string>
>;

/** 手順で違う物を置いたら、決め手のうち合っていない最初のものにし、何に当たったかを光で見せる。決め手の無い操作の手順では `null`。 */
function getStepLightEntry(
  step: ReflectionTutorialStep,
  board: ReflectionBoard,
): ReflectionEntry | null {
  const [first] = step.reasonEntries;
  if (findStepPlacedCellIndex(step, board) === null) {
    return first ?? null;
  }
  const matches = listReflectionClueMatches(board, problem.clues);
  return (
    step.reasonEntries.find(
      (entry) => !matches[getReflectionEntryIndex(SIZE, entry)],
    ) ??
    first ??
    null
  );
}

function describeStep(
  step: ReflectionTutorialStep,
  session: ReflectionSession,
): TutorialMessage {
  const placedCellIndex = findStepPlacedCellIndex(step, session.puzzleState);
  const lightEntry = getStepLightEntry(step, session.puzzleState);
  if (placedCellIndex !== null && step.choice !== "none" && lightEntry) {
    const selected =
      session.selection?.type === "cell" &&
      session.selection.cellIndex === placedCellIndex;
    return {
      headline: describeLight(session.puzzleState, lightEntry),
      detail: fixDetails[step.choice][selected ? "selected" : "unselected"],
    };
  }
  const pieceSelected =
    session.selection?.type === "stock" &&
    session.selection.piece === step.piece;
  return pieceSelected && step.midwayMessage
    ? step.midwayMessage
    : step.message;
}

const freePlay: TutorialMessage = {
  headline: "残りのピースも置いてみましょう",
  detail: "数字をタップすると\n今の光の道筋が見えます",
};

const unsolvedMessage: TutorialMessage = {
  headline: "緑でない数字があります",
  detail: null,
};

/** 完成の一言は `games/tutorial.ts` の進行が出す。 */
export function describeReflectionTutorialMessage(
  { step }: ReflectionTutorialSituation,
  { session }: ReflectionTutorialBoardState,
): TutorialMessage {
  if (step !== null) {
    return describeStep(step, session);
  }
  return isStockEmpty(session) ? unsolvedMessage : freePlay;
}

export const REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT = placements.length;

export function getReflectionTutorialProgressRatio({
  session,
}: ReflectionTutorialBoardState): number {
  const placedCount = placements.filter(
    ({ piece, cellIndex }) => session.puzzleState.cells[cellIndex] === piece,
  ).length;
  return placedCount / REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT;
}

/** 手を離した直後は、最後の手順の結果の光を押したものとして見せる。 */
export function getReflectionTutorialLaserEntry(
  { step }: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
  resultShown: boolean,
): ReflectionEntry | null {
  if (step === null) {
    return state.session.laserEntry;
  }
  const resultEntry = resultShown ? state.lastMove?.litEntry : null;
  return resultEntry ?? getStepLightEntry(step, state.session.puzzleState);
}

function markNamedPieces(
  step: ReflectionTutorialStep,
): ReflectionTutorialMark[] {
  return step.namedPieces.map((piece) => ({
    target: { type: "stock", piece },
    pointed: false,
  }));
}

/**
 * 手を離した後は空。
 * - 選ばせないピースは、選んだ後も、ほかを押されたときに目を向けさせるよう輪郭を残す。
 * - 解と違う物を置いたら、置いたピースを選ぶまで輪郭で示し、ピースを選ばせる手順では置き換え先の名前のピースにも輪郭を付ける。
 */
export function listReflectionTutorialStepMarks(
  { step }: ReflectionTutorialSituation,
  { session }: ReflectionTutorialBoardState,
): ReflectionTutorialMark[] {
  if (step === null) {
    return [];
  }
  const { selection } = session;
  const placedCellIndex = findStepPlacedCellIndex(step, session.puzzleState);
  if (placedCellIndex !== null) {
    const placedSelected =
      selection?.type === "cell" && selection.cellIndex === placedCellIndex;
    return [
      ...(placedSelected
        ? []
        : [
            {
              target: { type: "cell", cellIndex: placedCellIndex },
              pointed: false,
            } as const,
          ]),
      ...(choosesPiece(step) ? markNamedPieces(step) : []),
    ];
  }
  const stepPieceSelected =
    selection?.type === "stock" && selection.piece === step.piece;
  const marks: ReflectionTutorialMark[] = [];
  if (choosesPiece(step)) {
    marks.push(...markNamedPieces(step));
  } else if (step.choice === "cell" || !stepPieceSelected) {
    marks.push({
      target: { type: "stock", piece: step.piece },
      pointed: !stepPieceSelected,
    });
  }
  if (!choosesCell(step)) {
    marks.push({
      target: { type: "cell", cellIndex: step.cellIndex },
      pointed: false,
    });
  }
  return marks;
}

/** 抜くのは、決め手の外周ヒントと、光を見せる外周ヒントから入れた今の光が通るマスと、印のマス。 */
function spotlightReasons(
  board: ReflectionBoard,
  reasonEntries: readonly ReflectionEntry[],
  lightEntry: ReflectionEntry | null,
  markedCellIndices: readonly number[],
): ReflectionTutorialSpotlight {
  if (lightEntry === null) {
    return { entries: [], cellIndices: [] };
  }
  const litCellIndices = traceReflectionLaser(board, lightEntry).path.map(
    ({ cellIndex }) => cellIndex,
  );
  return {
    entries: reasonEntries,
    cellIndices: [...new Set([...litCellIndices, ...markedCellIndices])],
  };
}

/** 手を離した後と、決め手の無い操作の手順では空で、盤面を覆わない。 */
export function getReflectionTutorialStepSpotlight(
  situation: ReflectionTutorialSituation,
  state: ReflectionTutorialBoardState,
): ReflectionTutorialSpotlight {
  const { step } = situation;
  const board = state.session.puzzleState;
  return spotlightReasons(
    board,
    step?.reasonEntries ?? [],
    step ? getStepLightEntry(step, board) : null,
    listReflectionTutorialStepMarks(situation, state).flatMap(({ target }) =>
      target.type === "cell" ? [target.cellIndex] : [],
    ),
  );
}

/** 解と違う所に置いたピースを示すときは決め手が無いので空。 */
export function getReflectionTutorialHintSpotlight(
  hint: ReflectionTutorialHint,
  { session }: ReflectionTutorialBoardState,
): ReflectionTutorialSpotlight {
  return spotlightReasons(
    session.puzzleState,
    hint.reasonEntries,
    hint.reasonEntries[0] ?? null,
    hint.target.type === "cell" ? [hint.target.cellIndex] : [],
  );
}

const mistakenHintMessage: TutorialMessage = {
  headline: "緑でない数字があります",
  detail: "印のピースをタップして\n別のマスへ動かします",
};

function createPlacementHint(
  placement: ReflectionTutorialPlacement,
  target: ReflectionTutorialTarget,
): ReflectionTutorialHint {
  return {
    target,
    reasonEntries: placement.reasonEntries,
    message: pieceRuleMessages[placement.piece],
  };
}

function createMistakenHint(
  target: ReflectionTutorialTarget,
): ReflectionTutorialHint {
  return { target, reasonEntries: [], message: mistakenHintMessage };
}

function findPlaceable(
  session: ReflectionSession,
): ReflectionTutorialPlacement | null {
  const { cells } = session.puzzleState;
  const stock = getReflectionSessionStock(session);
  return (
    placements.find(
      (placement) =>
        cells[placement.cellIndex] === null && stock[placement.piece] > 0,
    ) ?? null
  );
}

function findMistakenCellIndex(board: ReflectionBoard): number | null {
  const cellIndex = board.cells.findIndex(
    (cell, index) => cell !== null && solution.cells[index] !== cell,
  );
  return cellIndex >= 0 ? cellIndex : null;
}

/**
 * 揃っていれば `null`。
 * - ストックの種類を選んでいる: その種類の解のマスが空いていればそこを、ふさがれていれば選んだ種類を押して選ぶのをやめさせる。
 * - 盤面のピースを選んでいる: 示すピースがそれなら、その解のマスを示す。そうでなければ、押して選ぶのをやめさせる。
 * - 何も選んでいない: ストックの種類か、示すピースを選ばせる。
 */
export function findReflectionTutorialHint({
  session,
}: ReflectionTutorialBoardState): ReflectionTutorialHint | null {
  const { puzzleState: board, selection } = session;
  if (selection?.type === "stock") {
    const placement = placements.find(
      (candidate) =>
        candidate.piece === selection.piece &&
        board.cells[candidate.cellIndex] === null,
    );
    return placement
      ? createPlacementHint(placement, {
          type: "cell",
          cellIndex: placement.cellIndex,
        })
      : createMistakenHint({ type: "stock", piece: selection.piece });
  }
  const placeable = findPlaceable({ ...session, selection: null });
  const mistakenCellIndex =
    placeable === null ? findMistakenCellIndex(board) : null;
  if (selection?.type !== "cell") {
    if (placeable) {
      return createPlacementHint(placeable, {
        type: "stock",
        piece: placeable.piece,
      });
    }
    return mistakenCellIndex === null
      ? null
      : createMistakenHint({ type: "cell", cellIndex: mistakenCellIndex });
  }
  const piece = board.cells[selection.cellIndex] ?? null;
  const destination =
    mistakenCellIndex === selection.cellIndex
      ? placements.find(
          (candidate) =>
            candidate.piece === piece &&
            board.cells[candidate.cellIndex] !== piece,
        )
      : undefined;
  return destination
    ? createPlacementHint(destination, {
        type: "cell",
        cellIndex: destination.cellIndex,
      })
    : createMistakenHint({ type: "cell", cellIndex: selection.cellIndex });
}

export const reflectionTutorial: Tutorial<
  ReflectionTutorialRuleId,
  ReflectionTutorialStep,
  ReflectionTutorialBoardState,
  ReflectionTutorialAction
> = {
  intro: {
    purpose: "数字と記号に合わせ光が進むようにピースを置くパズルです",
    goalCaption: "数字をすべて緑にすると完成です",
  },
  rules: [
    { id: "black-hole", label: "ブラックホールは光を止めます" },
    { id: "number", label: "光が通るマスの数が書かれています" },
    { id: "mirror", label: "斜め鏡は光を直角に曲げます" },
    { id: "reflector", label: "反射鏡は光をはね返します" },
    { id: "double", label: "両面鏡は当たる光をはね返し沿って進む光は通します" },
  ],
  steps,
  freePlay,
  completion: {
    home: {
      headline: "完成です",
      detail:
        "両面鏡には横向きだけでなく縦向きもあります\n数字1つで決まる所から置きます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
    },
  },
  start: startReflectionTutorial,
  goal: getReflectionTutorialGoal,
  perform: performReflectionTutorialAction,
  describeViolation: describeReflectionTutorialMessage,
};

export const _private = {
  fixDetails,
  unsolvedMessage,
  mistakenHintMessage,
  pieceRuleMessages,
  describeLight,
  solution,
  problem,
  steps,
  placements,
  freePlacements,
  cellAt,
  getStepStartBoard,
};
