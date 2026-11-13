import {
  createHitofudePuzzleAdjacency,
  findHitofudePuzzleDirection,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleBoard,
  type HitofudePuzzleDirection,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  findHitofudePuzzleStranding,
  isHitofudePuzzleDeadEnd,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";
import {
  extendHitofudePuzzle,
  type HitofudePuzzleExtensionRejection,
  type HitofudePuzzleTraceStep,
  moveHitofudePuzzleHead,
  rewindHitofudePuzzle,
  traceHitofudePuzzle,
} from "@/games/hitofude-puzzle/puzzle/transitions";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type HitofudePuzzleTutorialRuleId = "hole" | "all" | "narrow";

const allRuleIds: readonly HitofudePuzzleTutorialRuleId[] = [
  "hole",
  "all",
  "narrow",
];

/**
 * - `press`: マスを押す（なぞり始め）。
 * - `move`: 矢印キーで先端をその向きへ動かす。
 */
export type HitofudePuzzleTutorialAction =
  | { type: "press"; cell: number }
  | { type: "trace"; step: HitofudePuzzleTraceStep }
  | { type: "move"; direction: HitofudePuzzleDirection };

/**
 * - `route`: この手順で延ばす、解の道のマス。延ばす順に並べ、最後のマスまで解のとおりに延ばすと次の手順へ進む。
 * - `marks`: 印を付ける行き先のマス。2つあれば、どちらへ進むかを選ばせる。
 * - `reasonCells`: この手順で伝えたルールで、行き先を決める盤面のマス（決め手）。
 */
export type HitofudePuzzleTutorialStep =
  TutorialStep<HitofudePuzzleTutorialRuleId> & {
    route: readonly number[];
    marks: readonly number[];
    reasonCells: readonly number[];
  };

/** `blocked` の `cell` は盤面の外なら `null`、`direction` は進もうとしたマスが先端の隣でなければ `null`。 */
export type HitofudePuzzleTutorialMove =
  | { type: "extended"; cells: readonly number[] }
  | { type: "shortened" }
  | {
      type: "blocked";
      cell: number | null;
      direction: HitofudePuzzleDirection | null;
      reason: HitofudePuzzleExtensionRejection;
    };

export type HitofudePuzzleTutorialBoardState = {
  path: readonly number[];
  /** 盤面が反応した手の数。同じマスへの反応をやり直す目印に使う。 */
  moveCount: number;
  lastMove: HitofudePuzzleTutorialMove | null;
};

export type HitofudePuzzleTutorialSituation = TutorialSituation<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialStep
>;

/**
 * 今の道のままでは全マスを通れないと盤面から分かること。
 * - `stranded`: 先端からたどり着けないマスが残った。
 * - `two-ends`: 通れる隣が1つだけのマス（道の終わりにしかなれないマス）が2つ以上できた。
 */
export type HitofudePuzzleTutorialStranding =
  | { kind: "dead-end" }
  | { kind: "stranded" | "two-ends"; cells: readonly number[] };

/**
 * - `extend`: `ruleId` はほかの向きを退けるルール、`reasonCells` はほかへ進むと入れなくなる・道の終わりになるマス。伝えたルールで決まらなければ `null` と空。
 * - `rewind`: 道が解から外れたので、外れる前の `cell` まで戻す。
 */
export type HitofudePuzzleTutorialHint =
  | {
      kind: "extend";
      cell: number;
      ruleId: Extract<HitofudePuzzleTutorialRuleId, "all" | "narrow"> | null;
      reasonCells: readonly number[];
    }
  | { kind: "rewind"; cell: number };

/**
 * ```text
 * 盤面          ゴール（通る順）
 * S . . . .     0  1  2 19 20
 * # # . . #     #  #  3 18  #
 * . . . . .     6  5  4 17 16
 * . . . . .     7  8 11 12 15
 * # . . . .     #  9 10 13 14
 * ```
 */
const board: HitofudePuzzleBoard = parseHitofudePuzzleBoard([
  "S . . . .",
  "# # . . #",
  ". . . . .",
  ". . . . .",
  "# . . . .",
]);
const solution: readonly number[] = [
  0, 1, 2, 7, 12, 11, 10, 15, 16, 21, 22, 17, 18, 23, 24, 19, 14, 13, 8, 3, 4,
];

const narrowMessage: TutorialMessage = {
  headline: "マスが2つ隣接するマスをなぞっていきます",
  detail: "マスが1つのみ隣接するマスがゴールになります",
};

const steps: readonly HitofudePuzzleTutorialStep[] = [
  {
    message: {
      headline: "丸のマスから\n印のマスまでなぞります",
      detail: null,
    },
    introducedRuleId: null,
    route: [1],
    marks: [1],
    reasonCells: [],
  },
  {
    message: {
      headline: "マスのない所をよけて印のマスまでなぞります",
      detail: null,
    },
    introducedRuleId: "hole",
    route: [2, 7, 12, 11],
    marks: [11],
    reasonCells: [],
  },
  {
    message: {
      headline: "マスを残さないように\n印のマスまでなぞります",
      detail: "残したマスには入れなくなります",
    },
    introducedRuleId: "all",
    route: [10, 15, 16, 21],
    marks: [21],
    reasonCells: [10, 15],
  },
  {
    message: narrowMessage,
    introducedRuleId: "narrow",
    route: [22, 17],
    marks: [17, 23],
    reasonCells: [18, 4],
  },
];

function isSolutionPrefix(path: readonly number[]): boolean {
  return path.every((cell, index) => solution[index] === cell);
}

function countSolutionPrefix(path: readonly number[]): number {
  const deviation = path.findIndex((cell, index) => solution[index] !== cell);
  return deviation < 0 ? path.length : deviation;
}

function findVisibleStranding(
  path: readonly number[],
  earnedRuleIds: readonly HitofudePuzzleTutorialRuleId[],
): HitofudePuzzleTutorialStranding | null {
  if (!earnedRuleIds.includes("all")) {
    return null;
  }
  if (isHitofudePuzzleDeadEnd(board, path)) {
    return { kind: "dead-end" };
  }
  const stranding = findHitofudePuzzleStranding(board, path);
  if (stranding === null) {
    return null;
  }
  const unreachableCells = [
    ...new Set([...stranding.isolatedCells, ...stranding.separatedCells]),
  ];
  if (unreachableCells.length > 0) {
    return { kind: "stranded", cells: unreachableCells };
  }
  return earnedRuleIds.includes("narrow") && stranding.deadEndCells.length > 0
    ? { kind: "two-ends", cells: stranding.deadEndCells }
    : null;
}

/** `unchanged` は、先端を押した・道から外れた指が動いたなど、何も起きなかった手。 */
type PlayedAction =
  | { kind: "changed"; path: readonly number[] }
  | {
      kind: "blocked";
      move: Extract<HitofudePuzzleTutorialMove, { type: "blocked" }>;
    }
  | { kind: "unchanged" };

function blockedAt(
  path: readonly number[],
  cell: number | null,
  reason: HitofudePuzzleExtensionRejection,
): PlayedAction {
  const head = path.at(-1) ?? board.start;
  return {
    kind: "blocked",
    move: {
      type: "blocked",
      cell,
      direction:
        cell === null
          ? null
          : findHitofudePuzzleDirection(board.size, head, cell),
      reason,
    },
  };
}

function playAction(
  path: readonly number[],
  action: HitofudePuzzleTutorialAction,
): PlayedAction {
  const state = { path };
  switch (action.type) {
    case "press": {
      if (path.includes(action.cell)) {
        const rewound = rewindHitofudePuzzle(state, action.cell);
        return rewound === state
          ? { kind: "unchanged" }
          : { kind: "changed", path: rewound.path };
      }
      const extension = extendHitofudePuzzle(board, state, action.cell);
      return extension.kind === "extended"
        ? { kind: "changed", path: extension.state.path }
        : blockedAt(path, action.cell, extension.reason);
    }
    case "trace": {
      const trace = traceHitofudePuzzle(board, state, action.step);
      if (trace.kind === "rejected") {
        return blockedAt(path, action.step.to, trace.reason);
      }
      return trace.kind === "unchanged"
        ? { kind: "unchanged" }
        : { kind: "changed", path: trace.state.path };
    }
    case "move": {
      const head = path.at(-1) ?? board.start;
      const neighbor = getHitofudePuzzleNeighborCell(
        board.size,
        head,
        action.direction,
      );
      if (neighbor === null) {
        return {
          kind: "blocked",
          move: {
            type: "blocked",
            cell: null,
            direction: action.direction,
            reason: "outside-board",
          },
        };
      }
      const move = moveHitofudePuzzleHead(board, state, neighbor);
      return move.kind === "rejected"
        ? blockedAt(path, neighbor, move.reason)
        : { kind: "changed", path: move.state.path };
    }
  }
}

function toPathMove(
  before: readonly number[],
  after: readonly number[],
): HitofudePuzzleTutorialMove {
  return after.length > before.length
    ? { type: "extended", cells: after.slice(before.length) }
    : { type: "shortened" };
}

function getStepStartLength(step: HitofudePuzzleTutorialStep): number {
  return solution.indexOf(step.route[0] ?? board.start);
}

function getStepEndLength(step: HitofudePuzzleTutorialStep): number {
  return solution.indexOf(step.route.at(-1) ?? board.start) + 1;
}

function judgeChangedPath(
  path: readonly number[],
  earnedRuleIds: readonly HitofudePuzzleTutorialRuleId[],
): TutorialMoveOutcome {
  if (isHitofudePuzzleSolved(board, path)) {
    return "solved";
  }
  return findVisibleStranding(path, earnedRuleIds) === null
    ? "continued"
    : "violated";
}

function performGuided(
  step: HitofudePuzzleTutorialStep,
  earnedRuleIds: readonly HitofudePuzzleTutorialRuleId[],
  state: HitofudePuzzleTutorialBoardState,
  played: PlayedAction,
): { state: HitofudePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (played.kind === "blocked") {
    return played.move.reason === "hole" && earnedRuleIds.includes("hole")
      ? {
          state: {
            ...state,
            moveCount: state.moveCount + 1,
            lastMove: played.move,
          },
          outcome: "violated",
        }
      : { state, outcome: "ignored" };
  }
  if (played.kind === "unchanged") {
    return { state, outcome: "ignored" };
  }
  const { path } = played;
  const stepCells = new Set([...step.route, ...step.marks]);
  const added = path.slice(state.path.length);
  const accepted =
    path.length > state.path.length
      ? added.every((cell) => stepCells.has(cell))
      : path.length >= getStepStartLength(step);
  if (!accepted) {
    return { state, outcome: "ignored" };
  }
  const next: HitofudePuzzleTutorialBoardState = {
    path,
    moveCount: state.moveCount + 1,
    lastMove: toPathMove(state.path, path),
  };
  const finishesStep =
    path.length === getStepEndLength(step) && isSolutionPrefix(path);
  return {
    state: next,
    outcome: finishesStep ? "stepped" : judgeChangedPath(path, earnedRuleIds),
  };
}

function performFree(
  earnedRuleIds: readonly HitofudePuzzleTutorialRuleId[],
  state: HitofudePuzzleTutorialBoardState,
  played: PlayedAction,
): { state: HitofudePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  switch (played.kind) {
    case "unchanged":
      return { state, outcome: "ignored" };
    case "blocked":
      return {
        state: {
          ...state,
          moveCount: state.moveCount + 1,
          lastMove: played.move,
        },
        outcome:
          played.move.reason === "hole" ||
          findVisibleStranding(state.path, earnedRuleIds) !== null
            ? "violated"
            : "continued",
      };
    case "changed":
      return {
        state: {
          path: played.path,
          moveCount: state.moveCount + 1,
          lastMove: toPathMove(state.path, played.path),
        },
        outcome: judgeChangedPath(played.path, earnedRuleIds),
      };
  }
}

function performHitofudePuzzleTutorialAction(
  { step, earnedRuleIds }: HitofudePuzzleTutorialSituation,
  state: HitofudePuzzleTutorialBoardState,
  action: HitofudePuzzleTutorialAction,
): { state: HitofudePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  const played = playAction(state.path, action);
  return step === null
    ? performFree(earnedRuleIds, state, played)
    : performGuided(step, earnedRuleIds, state, played);
}

const backToMarkDetail = "印のマスを押してそこまで戻します";

const strandingMessages = {
  "dead-end": {
    headline: "行き止まりです\n通っていないマスが残っています",
    detail: backToMarkDetail,
  },
  stranded: {
    headline: "入れなくなったマスがあります",
    detail: backToMarkDetail,
  },
  "two-ends": {
    headline: "ゴールになるマスが2つできました",
    detail: backToMarkDetail,
  },
} as const satisfies Record<
  HitofudePuzzleTutorialStranding["kind"],
  TutorialMessage
>;

function describeHitofudePuzzleTutorialViolation(
  { earnedRuleIds }: HitofudePuzzleTutorialSituation,
  { path }: HitofudePuzzleTutorialBoardState,
): TutorialMessage {
  const stranding = findVisibleStranding(path, earnedRuleIds);
  // 違反になるのは、全マスを通れなくなったと分かる道と、穴へ進もうとした手だけ。
  return stranding === null
    ? { headline: "そこは通れません", detail: "マスのない所をよけてなぞります" }
    : strandingMessages[stranding.kind];
}

function startHitofudePuzzleTutorial(): HitofudePuzzleTutorialBoardState {
  return { path: [board.start], moveCount: 0, lastMove: null };
}

function getHitofudePuzzleTutorialGoal(): HitofudePuzzleTutorialBoardState {
  return { path: solution, moveCount: 0, lastMove: null };
}

export const HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT = solution.length - 1;

export function getHitofudePuzzleTutorialProgressRatio({
  path,
}: HitofudePuzzleTutorialBoardState): number {
  return (
    Math.max(countSolutionPrefix(path) - 1, 0) /
    HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT
  );
}

export const hitofudePuzzleTutorialBoard = board;

export function isHitofudePuzzleTutorialDeadEnd({
  path,
}: HitofudePuzzleTutorialBoardState): boolean {
  return isHitofudePuzzleDeadEnd(board, path);
}

/** まだ通っていないマスだけを返す。手を離した後は空。 */
export function getHitofudePuzzleTutorialStepMarks(
  { step }: HitofudePuzzleTutorialSituation,
  { path }: HitofudePuzzleTutorialBoardState,
): number[] {
  return (step?.marks ?? []).filter((cell) => !path.includes(cell));
}

/** 手を離した後は空。 */
export function getHitofudePuzzleTutorialStepReasonCells({
  step,
}: HitofudePuzzleTutorialSituation): readonly number[] {
  return step?.reasonCells ?? [];
}

/**
 * 違反が無ければ `null`。
 * `fixCell` は道が解から外れる前の最後のマス。穴に阻まれただけで道が変わっていなければ `null`。
 */
export function findHitofudePuzzleTutorialViolation(
  { earnedRuleIds }: HitofudePuzzleTutorialSituation,
  { path }: HitofudePuzzleTutorialBoardState,
): { fixCell: number | null; cells: readonly number[] } | null {
  const stranding = findVisibleStranding(path, earnedRuleIds);
  if (stranding === null) {
    return null;
  }
  const fixCell = solution[countSolutionPrefix(path) - 1] ?? null;
  return {
    fixCell: fixCell === path.at(-1) ? null : fixCell,
    cells: stranding.kind === "dead-end" ? [] : stranding.cells,
  };
}

/** 解き終えていれば `null`。 */
export function findHitofudePuzzleTutorialHint({
  path,
}: HitofudePuzzleTutorialBoardState): HitofudePuzzleTutorialHint | null {
  const prefixLength = countSolutionPrefix(path);
  if (prefixLength < path.length) {
    const cell = solution[prefixLength - 1];
    return cell === undefined ? null : { kind: "rewind", cell };
  }
  const next = solution[path.length];
  if (next === undefined) {
    return null;
  }
  return { kind: "extend", cell: next, ...findForkReason(path, next) };
}

/**
 * 先端からほかへ進む手を、どのルールが退けるか。すべてのルールを伝えた後に出す手がかりなので、すべてのルールで見る。
 * ほかの手がすべて退けられるときだけ、退けたルールと、そのとき入れなくなる・道の終わりになるマスを返す。
 * 一本道と、ルールでは決まらない分かれ道（手順の道筋まで戻したときに出る）では、決め手を添えない。
 */
function findForkReason(
  path: readonly number[],
  next: number,
): Pick<
  Extract<HitofudePuzzleTutorialHint, { kind: "extend" }>,
  "ruleId" | "reasonCells"
> {
  const head = path.at(-1) ?? board.start;
  const others = createHitofudePuzzleAdjacency(board)[head]!.filter(
    (cell) => cell !== next && !path.includes(cell),
  );
  const strandings = others.map((cell) =>
    findVisibleStranding([...path, cell], allRuleIds),
  );
  if (
    others.length === 0 ||
    strandings.some((stranding) => stranding === null)
  ) {
    return { ruleId: null, reasonCells: [] };
  }
  const reasonCells = [
    ...new Set(
      strandings.flatMap((stranding) =>
        stranding === null || stranding.kind === "dead-end"
          ? []
          : stranding.cells,
      ),
    ),
  ].filter((cell) => cell !== next);
  const ruleId = strandings.every((stranding) => stranding?.kind === "two-ends")
    ? "narrow"
    : "all";
  return { ruleId, reasonCells };
}

/** 伝えたルールで決まらない手なら `null`。 */
export function describeHitofudePuzzleTutorialHint(
  hint: HitofudePuzzleTutorialHint,
): TutorialMessage | null {
  if (hint.kind === "rewind") {
    return { headline: backToMarkDetail, detail: null };
  }
  return hint.ruleId === null
    ? null
    : (steps.find((step) => step.introducedRuleId === hint.ruleId)?.message ??
        null);
}

export const HITOFUDE_PUZZLE_TUTORIAL_RECAP: readonly string[] = [
  "マスのない所をよけてなぞります",
  "全てのマスを1回ずつなぞります",
  "マスが2つ隣接するマスをなぞっていきます",
  "マスが1つのみ隣接するマスがゴールになります",
];

export const hitofudePuzzleTutorial: Tutorial<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialStep,
  HitofudePuzzleTutorialBoardState,
  HitofudePuzzleTutorialAction
> = {
  intro: {
    purpose: "全てのマスを一筆書きでなぞるパズルです",
    goalCaption: "全てのマスをなぞると完成です",
  },
  rules: [
    { id: "hole", label: "マスのない所をよけてなぞります" },
    { id: "all", label: "全てのマスを1回ずつなぞります" },
    { id: "narrow", label: "マスが2つ隣接するマスをなぞっていきます" },
  ],
  steps,
  freePlay: {
    headline: "残りのマスもなぞってみましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "隣接するマスが少ないマスから先になぞると解きやすくなります",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
    },
  },
  start: startHitofudePuzzleTutorial,
  goal: getHitofudePuzzleTutorialGoal,
  perform: performHitofudePuzzleTutorialAction,
  describeViolation: describeHitofudePuzzleTutorialViolation,
};

export const _private = {
  board,
  solution,
  findVisibleStranding,
};
