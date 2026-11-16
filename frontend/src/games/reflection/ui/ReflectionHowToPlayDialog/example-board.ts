import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  getReflectionInventoryPieceCount,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  getReflectionEntryIndex,
  isSameReflectionClue,
  type ReflectionClue,
  type ReflectionEntry,
  type ReflectionLaserTrace,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import {
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionStock,
  type ReflectionSession,
  removeReflectionSessionPiece,
  reopenReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
} from "@/games/reflection/session/session";
import {
  isSameReflectionCueTarget,
  type ReflectionCueTarget,
} from "@/games/reflection/ui/board/cue";
import type { ReflectionHowToPlayExample } from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";

/**
 * 触れる例の今の姿。本番の1回のプレイ（`ReflectionSession`）をそのまま持ち、本番の操作で進める。経過時間と回数は使わない。
 * `handStep` は、例が見せる手のうち次に押す所の番号。手から外れた手を打ったら `null` にし、始まりの姿に戻ったら 0 に戻す。
 */
export type ReflectionExampleBoard = {
  session: ReflectionSession;
  handStep: number | null;
};

/** 例では時刻を使わないので、操作の時刻はどれも同じにする。 */
const EXAMPLE_OPERATED_AT = 0;

function createExampleProblem({
  solution,
}: ReflectionHowToPlayExample): ReflectionProblem {
  return {
    size: solution.size,
    inventory: countReflectionBoardPieces(solution),
    clues: computeReflectionClues(solution),
    solution,
  };
}

export function createReflectionExampleBoard(
  example: ReflectionHowToPlayExample,
): ReflectionExampleBoard {
  return {
    session: createReflectionSession(
      createExampleProblem(example),
      EXAMPLE_OPERATED_AT,
      example.board,
    ),
    handStep: 0,
  };
}

function isSameBoard(left: ReflectionBoard, right: ReflectionBoard): boolean {
  return left.cells.every((cell, index) => cell === right.cells[index]);
}

/** 盤面・選んでいる物・光路のどれも、例の始まりの姿と同じか。 */
function isAtStart(
  session: ReflectionSession,
  example: ReflectionHowToPlayExample,
): boolean {
  return (
    session.status === "playing" &&
    session.selection === null &&
    session.laserEntry === null &&
    isSameBoard(session.puzzleState, example.board)
  );
}

function applyTarget(
  session: ReflectionSession,
  target: ReflectionCueTarget,
): ReflectionSession {
  switch (target.type) {
    case "cell":
      return tapReflectionSessionCell(
        session,
        target.cellIndex,
        EXAMPLE_OPERATED_AT,
      );
    case "stock":
      return tapReflectionSessionStock(
        session,
        target.piece,
        EXAMPLE_OPERATED_AT,
      );
    case "clue":
      return tapReflectionSessionClue(session, target.entry);
  }
}

/**
 * 手を打った後の、次に押す所の番号。始まりの姿に戻ったら最初から、例が見せる手のとおりなら次へ進め、
 * 手から外れたら、始まりの姿に戻るまで手がかりを出さない。
 */
function getNextHandStep(
  board: ReflectionExampleBoard,
  session: ReflectionSession,
  example: ReflectionHowToPlayExample,
  target: ReflectionCueTarget | null,
): number | null {
  if (isAtStart(session, example)) {
    return 0;
  }
  const expected =
    board.handStep === null ? undefined : example.hand[board.handStep];
  if (
    board.handStep !== null &&
    expected !== undefined &&
    target !== null &&
    isSameReflectionCueTarget(expected, target)
  ) {
    return board.handStep + 1;
  }
  return null;
}

/**
 * 完成を見せない例では、本番の判定で揃っても完成に入れず、プレイ中のまま触り続けられるようにする。
 * ルールと操作の例は、始まりの盤面が解き終えた形のものや、描く数字が無いものがあり、完成すると、
 * 動かして戻しただけで全光路と完成の音が出て押せなくなるため。
 */
function keepPlayingUnlessCompletes(
  session: ReflectionSession,
  example: ReflectionHowToPlayExample,
): ReflectionSession {
  return example.completes ? session : reopenReflectionSession(session);
}

/** 盤面・ストック・外周の数字を押す。本番と同じく、何も変わらない手では姿も手がかりも変えない。 */
export function tapReflectionExample(
  board: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
  target: ReflectionCueTarget,
): ReflectionExampleBoard {
  const applied = applyTarget(board.session, target);
  const session =
    applied === board.session
      ? applied
      : keepPlayingUnlessCompletes(applied, example);
  if (session === board.session) {
    return board;
  }
  return {
    session,
    handStep: getNextHandStep(board, session, example, target),
  };
}

/** 本番の盤面と同じく、Esc で選んでいる物を解く。例が見せる手ではない。 */
export function clearReflectionExampleSelection(
  board: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
): ReflectionExampleBoard {
  const session = clearReflectionSessionSelection(board.session);
  if (session === board.session) {
    return board;
  }
  return {
    session,
    handStep: getNextHandStep(board, session, example, null),
  };
}

/** 本番の盤面と同じく、キーボードでマスのピースをストックに戻す。例が見せる手ではない。 */
export function removeReflectionExamplePiece(
  board: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
  cellIndex: number,
): ReflectionExampleBoard {
  const session = removeReflectionSessionPiece(
    board.session,
    cellIndex,
    EXAMPLE_OPERATED_AT,
  );
  if (session === board.session) {
    return board;
  }
  return {
    session,
    handStep: getNextHandStep(board, session, example, null),
  };
}

/** 次に押す所。完成した後と、手から外れた後と、手を打ち終えた後は無い。 */
export function getReflectionExampleHint(
  { session, handStep }: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
): ReflectionCueTarget | null {
  if (session.status !== "playing" || handStep === null) {
    return null;
  }
  return example.hand[handStep] ?? null;
}

/**
 * 例が始まりの姿から変わったか。盤面・光路・完成が変わった姿とし、選んだだけの姿は、もう一度押せば戻せるので変わったとみなさない。
 */
export function hasReflectionExampleChanged(
  { session }: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
): boolean {
  return (
    session.status !== "playing" ||
    session.laserEntry !== null ||
    !isSameBoard(session.puzzleState, example.board)
  );
}

/** 本番の盤面と同じく、どの外周の数字が今の盤面の光と合っているか。 */
export function listReflectionExampleClueMatches({
  session,
}: ReflectionExampleBoard): boolean[] {
  return listReflectionClueMatches(session.puzzleState, session.problem.clues);
}

/** `entry` の外周の数字が、今の盤面の光と合っているか。 */
export function isReflectionExampleClueMatched(
  board: ReflectionExampleBoard,
  entry: ReflectionEntry,
): boolean {
  const index = getReflectionEntryIndex(board.session.problem.size, entry);
  return listReflectionExampleClueMatches(board)[index] ?? false;
}

/**
 * `entry` の数字が、数と印は今の光と同じなのに、光が出た先の数字が違って合わないときの、出た先の数字。それ以外は `null`。
 */
export function findReflectionExampleUnmatchedExitClue(
  board: ReflectionExampleBoard,
  entry: ReflectionEntry,
): ReflectionClue | null {
  const { problem, puzzleState } = board.session;
  const trace = traceReflectionLaser(puzzleState, entry);
  const clue = problem.clues[getReflectionEntryIndex(problem.size, entry)];
  if (
    clue === undefined ||
    trace.exit === null ||
    trace.outcome !== "exit" ||
    !isSameReflectionClue(trace, clue) ||
    isReflectionExampleClueMatched(board, entry)
  ) {
    return null;
  }
  return (
    problem.clues[getReflectionEntryIndex(problem.size, trace.exit)] ?? null
  );
}

/**
 * 例のピースを1つずつ動かして作れる盤面。始まりの盤面、ピースを1つ空いたマスへ移した盤面、ピースを1つストックへ戻した盤面。
 * ピース1つの例では、例で作れる盤面がこれで尽きる。
 */
export function listReflectionExampleReachableBoards(
  example: ReflectionHowToPlayExample,
): ReflectionBoard[] {
  const { cells, size } = example.board;
  const boards: ReflectionBoard[] = [example.board];
  cells.forEach((piece, from) => {
    if (piece === null) {
      return;
    }
    const without = cells.map((cell, index) => (index === from ? null : cell));
    boards.push({ size, cells: without });
    without.forEach((cell, to) => {
      if (cell === null && to !== from) {
        boards.push({
          size,
          cells: without.map((other, index) => (index === to ? piece : other)),
        });
      }
    });
  });
  return boards;
}

/** 今の盤面で光路を出している外周の位置と、その光路。 */
export function getReflectionExampleLaser({
  session,
}: ReflectionExampleBoard): {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
} | null {
  const entry = session.laserEntry;
  return entry === null
    ? null
    : { entry, trace: traceReflectionLaser(session.puzzleState, entry) };
}

/**
 * 完成の判定。手持ちのピースが残っている間は途中、置き切って完成していれば完成、置き切って合わない数字が残れば合わない。
 */
export type ReflectionExampleCompletion = "incomplete" | "solved" | "unsolved";

export function judgeReflectionExampleCompletion({
  session,
}: ReflectionExampleBoard): ReflectionExampleCompletion {
  if (session.status === "cleared") {
    return "solved";
  }
  return getReflectionInventoryPieceCount(getReflectionSessionStock(session)) >
    0
    ? "incomplete"
    : "unsolved";
}
