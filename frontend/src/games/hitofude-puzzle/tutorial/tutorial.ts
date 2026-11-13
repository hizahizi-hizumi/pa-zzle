import {
  findHitofudePuzzleDirection,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleBoard,
  type HitofudePuzzleDirection,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
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

/** `all`: 穴でないすべてのマスを通る。道の終わりは1か所なので、入ると出られないマスが2つ残る道は引けない。 */
export type HitofudePuzzleTutorialRuleId = "once" | "hole" | "all";

/**
 * - `press`: マスを押す（なぞり始め）。
 * - `move`: 矢印キーで先端をその向きへ動かす。
 */
export type HitofudePuzzleTutorialAction =
  | { type: "press"; cell: number }
  | { type: "trace"; step: HitofudePuzzleTraceStep }
  | { type: "move"; direction: HitofudePuzzleDirection };

/**
 * - `cells`: 印を付け、手順の間だけ道を延ばせるマス。延ばす順に並べ、最後のマスまで延ばすと次の手順へ進む。
 * - `reasonCells`: この手順で伝えたルールで、手を決める盤面のマス（決め手）。操作を教える手順では空。
 */
export type HitofudePuzzleTutorialStep =
  TutorialStep<HitofudePuzzleTutorialRuleId> & {
    cells: readonly number[];
    reasonCells: readonly number[];
  };

/**
 * - `shortened`: 道が縮んだ。手を離した後にだけ起きる。
 * - `blocked`: 道を延ばせなかった。`cell` は進もうとしたマス（盤面の外なら `null`）、`direction` は先端から進もうとした向き（隣でなければ `null`）。
 */
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
 * 手が止まったときの手がかり。
 * - `extend`: 道が解の途中にあり、`cell` へ延ばせる。
 * - `rewind`: 道が解から外れたので、解から外れる前の `cell` まで戻す。
 */
export type HitofudePuzzleTutorialHint = {
  kind: "extend" | "rewind";
  cell: number;
};

/**
 * 真ん中より右下に開いた穴と、上の縁の欠けがある 4×4。始点から全マスを通る道はゴールの1本だけ。
 *
 * ```text
 * 盤面      ゴール（通る順）
 * . # . .   13  #  1  2
 * . . S .   12 11  0  3
 * . . # .    9 10  #  4
 * . . . .    8  7  6  5
 * ```
 */
const board: HitofudePuzzleBoard = parseHitofudePuzzleBoard([
  ". # . .",
  ". . S .",
  ". . # .",
  ". . . .",
]);
const solution: readonly number[] = [
  6, 2, 3, 7, 11, 15, 14, 13, 12, 8, 9, 5, 4, 0,
];

/**
 * 先端から延ばすことを覚え、同じマス・穴・すべてのマスのルールを1つずつ、そのルールで決まる手に使う。
 * - 同じマス: 右の列を下りる途中、左の始点へは戻れない。
 * - 穴: 右下の角から下の段を左へ進む間、上の穴へは進めない。
 * - すべてのマス: 入ると出られない左上の角が道の終わりになる。左下の角も後から入ると出られず、終わりが2か所になるので、上へ曲がらずに今通る。
 * 手順を終えると左の列にいて、真ん中の穴の左を上がり、上の縁の欠けをよけて左上の角で終わる残りの4マスが、3つのルールで決まる。
 */
const steps: readonly HitofudePuzzleTutorialStep[] = [
  {
    message: {
      headline: "印のマスを順になぞります",
      detail: null,
    },
    introducedRuleId: null,
    cells: [2, 3],
    reasonCells: [],
  },
  {
    message: { headline: "同じマスは2回通れません", detail: null },
    introducedRuleId: "once",
    cells: [7, 11],
    reasonCells: [6],
  },
  {
    message: { headline: "穴は通れません", detail: null },
    introducedRuleId: "hole",
    cells: [15, 14, 13],
    reasonCells: [10],
  },
  {
    message: {
      headline: "すべてのマスを通ります\n左下の角は、今のうちに通ります",
      detail: "後回しにすると、左上の角まで行けません",
    },
    introducedRuleId: "all",
    cells: [12, 8],
    reasonCells: [12, 0],
  },
];

function isSolutionPrefix(path: readonly number[]): boolean {
  return path.every((cell, index) => solution[index] === cell);
}

function countSolutionPrefix(path: readonly number[]): number {
  const deviation = path.findIndex((cell, index) => solution[index] !== cell);
  return deviation < 0 ? path.length : deviation;
}

/** `unchanged`: 何も起きなかった（先端を押した、道から外れた指が動いた、など）。 */
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

/**
 * 阻まれた理由のうち、ルールに合わない手に当たるもの。離れたマスや盤面の外へ進もうとした手は、ルールではなく操作の外れなので当たらない。
 * なぞる指が通ったマスへ入っても本番は阻まず道を変えないので、通ったマスで阻まれるのは押した・矢印キーの手だけ。
 */
function findBrokenRule(
  reason: HitofudePuzzleExtensionRejection,
): Extract<HitofudePuzzleTutorialRuleId, "hole" | "once"> | null {
  switch (reason) {
    case "hole":
      return "hole";
    case "visited":
      return "once";
    case "not-adjacent":
    case "outside-board":
      return null;
  }
}

function getStepEndLength(step: HitofudePuzzleTutorialStep): number {
  return solution.indexOf(step.cells.at(-1) ?? board.start) + 1;
}

/**
 * 手を引いている間は、印のマスへ順に延ばす手だけを受け付ける。ほかの手は道を変えない。
 * 伝えたルールで阻まれる手（穴へ進む・通ったマスへ進む）だけは、本番と同じく阻まれたとして返す。
 */
function performGuided(
  step: HitofudePuzzleTutorialStep,
  earnedRuleIds: readonly HitofudePuzzleTutorialRuleId[],
  state: HitofudePuzzleTutorialBoardState,
  played: PlayedAction,
): { state: HitofudePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (played.kind === "blocked") {
    const brokenRule = findBrokenRule(played.move.reason);
    return brokenRule !== null && earnedRuleIds.includes(brokenRule)
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
  const stepEndLength = getStepEndLength(step);
  if (
    played.kind === "unchanged" ||
    played.path.length <= state.path.length ||
    played.path.length > stepEndLength ||
    !isSolutionPrefix(played.path)
  ) {
    return { state, outcome: "ignored" };
  }
  return {
    state: {
      path: played.path,
      moveCount: state.moveCount + 1,
      lastMove: toPathMove(state.path, played.path),
    },
    outcome: played.path.length === stepEndLength ? "stepped" : "continued",
  };
}

/**
 * 手を離した後は、本番と同じく道を延ばし、縮め、穴や離れたマスで阻む。
 * 穴や通ったマスへ進もうとした手と、解から外れて全マスを通れなくなった道は、ルールに合わない手として返す。
 */
function performFree(
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
          findBrokenRule(played.move.reason) !== null ||
          !isSolutionPrefix(state.path)
            ? "violated"
            : "continued",
      };
    case "changed": {
      const next: HitofudePuzzleTutorialBoardState = {
        path: played.path,
        moveCount: state.moveCount + 1,
        lastMove: toPathMove(state.path, played.path),
      };
      if (isHitofudePuzzleSolved(board, played.path)) {
        return { state: next, outcome: "solved" };
      }
      return {
        state: next,
        outcome: isSolutionPrefix(played.path) ? "continued" : "violated",
      };
    }
  }
}

function performHitofudePuzzleTutorialAction(
  { step, earnedRuleIds }: HitofudePuzzleTutorialSituation,
  state: HitofudePuzzleTutorialBoardState,
  action: HitofudePuzzleTutorialAction,
): { state: HitofudePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  const played = playAction(state.path, action);
  return step === null
    ? performFree(state, played)
    : performGuided(step, earnedRuleIds, state, played);
}

function describeHitofudePuzzleTutorialViolation(
  _situation: HitofudePuzzleTutorialSituation,
  { path, lastMove }: HitofudePuzzleTutorialBoardState,
): TutorialMessage {
  if (lastMove?.type === "blocked") {
    switch (findBrokenRule(lastMove.reason)) {
      case "hole":
        return { headline: "穴は通れません", detail: null };
      case "once":
        return { headline: "同じマスは2回通れません", detail: null };
      case null:
        break;
    }
  }
  return {
    headline: isHitofudePuzzleDeadEnd(board, path)
      ? "行き止まりです\n通っていないマスが残っています"
      : "このままでは\nたどり着けないマスが残ります",
    detail: "来た道をなぞって戻れば、やり直せます",
  };
}

function startHitofudePuzzleTutorial(): HitofudePuzzleTutorialBoardState {
  return { path: [board.start], moveCount: 0, lastMove: null };
}

function getHitofudePuzzleTutorialGoal(): HitofudePuzzleTutorialBoardState {
  return { path: solution, moveCount: 0, lastMove: null };
}

export const hitofudePuzzleTutorialBoard = board;

export function isHitofudePuzzleTutorialDeadEnd({
  path,
}: HitofudePuzzleTutorialBoardState): boolean {
  return isHitofudePuzzleDeadEnd(board, path);
}

export function getHitofudePuzzleTutorialStepCells(
  { step }: HitofudePuzzleTutorialSituation,
  { path }: HitofudePuzzleTutorialBoardState,
): number[] {
  return (step?.cells ?? []).filter((cell) => !path.includes(cell));
}

export function getHitofudePuzzleTutorialStepReasonCells({
  step,
}: HitofudePuzzleTutorialSituation): readonly number[] {
  return step?.reasonCells ?? [];
}

export function findHitofudePuzzleTutorialHint({
  path,
}: HitofudePuzzleTutorialBoardState): HitofudePuzzleTutorialHint | null {
  const prefixLength = countSolutionPrefix(path);
  if (prefixLength < path.length) {
    const cell = solution[prefixLength - 1];
    return cell === undefined ? null : { kind: "rewind", cell };
  }
  const next = solution[path.length];
  return next === undefined ? null : { kind: "extend", cell: next };
}

export const hitofudePuzzleTutorial: Tutorial<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialStep,
  HitofudePuzzleTutorialBoardState,
  HitofudePuzzleTutorialAction
> = {
  intro: {
    purpose: "穴以外のすべてのマスを1回ずつ通る\n1本の道を引くパズルです",
    goalCaption: "この形になれば完成です",
    startCaption: "輪の付いたマスから\n道を引きます",
  },
  rules: [
    { id: "once", label: "1回ずつ通る" },
    { id: "hole", label: "穴を通らない" },
    { id: "all", label: "全マスを通る" },
  ],
  steps,
  freePlay: {
    headline: "残りのマスも通れば完成です",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも、もっと広い盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
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
  isSolutionPrefix,
};
