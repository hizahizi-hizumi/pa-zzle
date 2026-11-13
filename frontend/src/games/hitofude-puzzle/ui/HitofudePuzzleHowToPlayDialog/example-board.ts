import {
  findHitofudePuzzleDirection,
  type HitofudePuzzleBoard,
  type HitofudePuzzleDirection,
  listHitofudePuzzleGridNeighbors,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  isHitofudePuzzleDeadEnd,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";
import {
  getHitofudePuzzleHead,
  type HitofudePuzzlePuzzleState,
} from "@/games/hitofude-puzzle/puzzle/state";
import {
  extendHitofudePuzzle,
  type HitofudePuzzleExtensionRejection,
  type HitofudePuzzleTraceStep,
} from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  beginHitofudePuzzleSessionStroke,
  createHitofudePuzzleSession,
  endHitofudePuzzleSessionStroke,
  type HitofudePuzzleSession,
  type HitofudePuzzleSessionPathChange,
  haveSameHitofudePuzzlePath,
  traceHitofudePuzzleSessionStroke,
} from "@/games/hitofude-puzzle/session/session";
import { strokeHitofudePuzzleSession } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/backtrack-flow";
import {
  getHitofudePuzzleHowToPlayHintCell,
  type HitofudePuzzleHowToPlayExample,
  type HitofudePuzzleHowToPlayHint,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";

/** 例では経過時間を使わないので、どの手も同じ時刻に打ったものとして本番の session へ渡す。 */
const EXAMPLE_OPERATED_AT = 0;

/** 道が延びた・縮んだ手。`head` は手の後の先端、`gesture` は押して打ったか、なぞって打ったか。 */
export type HitofudePuzzleExamplePathMove = {
  change: "extended" | "shortened";
  head: number;
  gesture: "press" | "trace";
};

/**
 * 盤面の反応と効果音に使う、道を変えたか弾かれた直前の手。道を変えない手（先端を押す、完成した後に押す、など）では替えない。
 * - `extended`・`shortened`: 道が延びた・縮んだ。
 * - `blocked`: 延ばせなかった。`cell` は進もうとしたマス、`direction` は先端から進もうとした向き（隣でなければ `null`）。
 */
export type HitofudePuzzleExampleMove =
  | HitofudePuzzleExamplePathMove
  | {
      change: "blocked";
      cell: number;
      direction: HitofudePuzzleDirection | null;
      reason: HitofudePuzzleExtensionRejection;
    };

/**
 * 触れる例の今の姿。盤面は本番の session として持ち、押す・なぞる・離すを本番の session の関数で打つ。経過時間と回数は使わない。
 * - `initialState`: 触る前の道。
 * - `hints`: 例が見せる手。
 * - `hintStates`: 触る前の道と、例が見せる手を1つずつ本番どおりに打っていった後の道。`hintStates[k]` が k 手打った後。
 * - `hintStep`: 例が見せる手を何手まで打ったか。触る前の道に戻ったら 0 に戻す。
 * - `lastPathMove`: 道を変えた直前の手。弾かれた手では替えない。
 */
export type HitofudePuzzleExampleBoard = {
  session: HitofudePuzzleSession;
  initialState: HitofudePuzzlePuzzleState;
  hints: readonly HitofudePuzzleHowToPlayHint[];
  hintStates: readonly HitofudePuzzlePuzzleState[];
  hintStep: number;
  lastMove: HitofudePuzzleExampleMove | null;
  lastPathMove: HitofudePuzzleExamplePathMove | null;
};

/** 今の道。始点から先端までに通ったマス。 */
export function getHitofudePuzzleExamplePath(
  example: HitofudePuzzleExampleBoard,
): readonly number[] {
  return example.session.puzzleState.path;
}

/** 例の盤面。 */
export function getHitofudePuzzleExampleBoard(
  example: HitofudePuzzleExampleBoard,
): HitofudePuzzleBoard {
  return example.session.problem;
}

/** 例の触る前の道を、本番の session で始点から1回のなぞりで引いた姿。すべてのマスを通る道なら、本番どおり完成している。 */
function createSessionAt(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): HitofudePuzzleSession {
  return strokeHitofudePuzzleSession(
    createHitofudePuzzleSession(board, EXAMPLE_OPERATED_AT),
    board.start,
    path.slice(1),
  );
}

/**
 * 本番の session が返した手の結果を、例に当てる。弾かれたら直前の手として残し、道が変わらなければ session だけを替える。
 * 道が変わったら、触る前の道に戻ったときは例が見せる手を最初からにし、例が見せる次の手のとおりに変わったときは手を1つ進める。
 * なぞる手として見せる手は、なぞって打ったときだけ進める。
 * `cell` は手が進もうとしたマス、`gesture` は手を押して打ったか、なぞって打ったか。
 */
function applyPathChange(
  example: HitofudePuzzleExampleBoard,
  { session, rejection }: HitofudePuzzleSessionPathChange,
  cell: number,
  gesture: "press" | "trace",
): HitofudePuzzleExampleBoard {
  const before = example.session.puzzleState;
  if (rejection !== null) {
    return {
      ...example,
      session,
      lastMove: {
        change: "blocked",
        cell,
        direction: findHitofudePuzzleDirection(
          session.problem.size,
          getHitofudePuzzleHead(before),
          cell,
        ),
        reason: rejection,
      },
    };
  }
  const after = session.puzzleState;
  if (haveSameHitofudePuzzlePath(after, before)) {
    return { ...example, session };
  }
  const nextHint = example.hints[example.hintStep];
  const nextHintState = example.hintStates[example.hintStep + 1];
  const followsHint =
    nextHint !== undefined &&
    nextHintState !== undefined &&
    haveSameHitofudePuzzlePath(after, nextHintState) &&
    (typeof nextHint === "number" || gesture === "trace");
  const hintStep = haveSameHitofudePuzzlePath(after, example.initialState)
    ? 0
    : followsHint
      ? example.hintStep + 1
      : example.hintStep;
  const pathMove: HitofudePuzzleExamplePathMove = {
    change: after.path.length > before.path.length ? "extended" : "shortened",
    head: getHitofudePuzzleHead(after),
    gesture,
  };
  return {
    ...example,
    session,
    hintStep,
    lastMove: pathMove,
    lastPathMove: pathMove,
  };
}

/** マスを押して、なぞり始める。本番の `beginHitofudePuzzleSessionStroke` で打つ。 */
export function pressHitofudePuzzleExampleCell(
  example: HitofudePuzzleExampleBoard,
  cell: number,
): HitofudePuzzleExampleBoard {
  return applyPathChange(
    example,
    beginHitofudePuzzleSessionStroke(
      example.session,
      cell,
      EXAMPLE_OPERATED_AT,
    ),
    cell,
    "press",
  );
}

/** なぞる指が隣のマスへ移ったときに道を変える。本番の `traceHitofudePuzzleSessionStroke` で打つ。 */
export function traceHitofudePuzzleExample(
  example: HitofudePuzzleExampleBoard,
  step: HitofudePuzzleTraceStep,
): HitofudePuzzleExampleBoard {
  return applyPathChange(
    example,
    traceHitofudePuzzleSessionStroke(
      example.session,
      step,
      EXAMPLE_OPERATED_AT,
    ),
    step.to,
    "trace",
  );
}

/** 指を離してなぞりを終える。本番の `endHitofudePuzzleSessionStroke` で打ち、道は変えない。 */
export function releaseHitofudePuzzleExample(
  example: HitofudePuzzleExampleBoard,
): HitofudePuzzleExampleBoard {
  return {
    ...example,
    session: endHitofudePuzzleSessionStroke(example.session),
  };
}

/**
 * 例が見せる手1つを、本番の session で打って離す。マスの番号の手は押し、なぞる手は先端を押してそのマスへなぞる。
 * 弾かれる手では道が変わらない。
 */
function playHint(
  session: HitofudePuzzleSession,
  hint: HitofudePuzzleHowToPlayHint,
): HitofudePuzzleSession {
  return typeof hint === "number"
    ? strokeHitofudePuzzleSession(session, hint, [])
    : strokeHitofudePuzzleSession(
        session,
        getHitofudePuzzleHead(session.puzzleState),
        [hint.traceTo],
      );
}

/** 触る前の道から、例が見せる手を本番の session で順に打っていった道。 */
function listHintStates(
  initial: HitofudePuzzleSession,
  hints: readonly HitofudePuzzleHowToPlayHint[],
): HitofudePuzzlePuzzleState[] {
  const states = [initial.puzzleState];
  let session = initial;
  for (const hint of hints) {
    session = playHint(session, hint);
    states.push(session.puzzleState);
  }
  return states;
}

export function createHitofudePuzzleExampleBoard(
  definition: HitofudePuzzleHowToPlayExample,
): HitofudePuzzleExampleBoard {
  const session = createSessionAt(definition.board, definition.path);
  return {
    session,
    initialState: session.puzzleState,
    hints: definition.hints,
    hintStates: listHintStates(session, definition.hints),
    hintStep: 0,
    lastMove: null,
    lastPathMove: null,
  };
}

/**
 * 押す所の手がかりを付けるマス。道が、例が見せる手を今まで打ったとおりの姿で、直前の手が弾かれていない間だけ、
 * 次に押すマスを返す。手を打ち終えたか、ほかの姿なら `null`。
 */
export function findHitofudePuzzleExampleHintCell(
  example: HitofudePuzzleExampleBoard,
): number | null {
  if (example.lastMove?.change === "blocked") {
    return null;
  }
  const expected = example.hintStates[example.hintStep];
  if (
    expected === undefined ||
    !haveSameHitofudePuzzlePath(example.session.puzzleState, expected)
  ) {
    return null;
  }
  const hint = example.hints[example.hintStep];
  return hint === undefined ? null : getHitofudePuzzleHowToPlayHintCell(hint);
}

/** 道が触る前と違うか。弾かれただけの手では道が変わらないので、違うとしない。 */
export function isHitofudePuzzleExampleChanged(
  example: HitofudePuzzleExampleBoard,
): boolean {
  return !haveSameHitofudePuzzlePath(
    example.session.puzzleState,
    example.initialState,
  );
}

/** 盤面の絵に渡す、行き止まりと完成。本番の判定そのもの。 */
export function getHitofudePuzzleExampleStatus(
  example: HitofudePuzzleExampleBoard,
): { isDeadEnd: boolean; solved: boolean } {
  const board = getHitofudePuzzleExampleBoard(example);
  const path = getHitofudePuzzleExamplePath(example);
  return {
    isDeadEnd: isHitofudePuzzleDeadEnd(board, path),
    solved: isHitofudePuzzleSolved(board, path),
  };
}

/** すべてのマスを通るまでに残っている、まだ通っていないマス。 */
export function listHitofudePuzzleExampleRemainingCells(
  example: HitofudePuzzleExampleBoard,
): number[] {
  const path = getHitofudePuzzleExamplePath(example);
  return listHitofudePuzzleOpenCells(
    getHitofudePuzzleExampleBoard(example),
  ).filter((cell) => !path.includes(cell));
}

/**
 * 形のルール（すべてのマスを通れば完成）の、今の盤面の判定。触った後も、今の盤面から本番の判定で出し直す。
 * - `allowed`: すべてのマスを通った（完成）。
 * - `disallowed`: すべてのマスを通る前に、先端から延ばせるマスが無い（行き止まり）。
 * - `incomplete`: まだ延ばせる途中。
 */
export type HitofudePuzzleExampleShapeVerdict =
  | "allowed"
  | "disallowed"
  | "incomplete";

export function judgeHitofudePuzzleExampleShape(
  example: HitofudePuzzleExampleBoard,
): HitofudePuzzleExampleShapeVerdict {
  const { solved, isDeadEnd } = getHitofudePuzzleExampleStatus(example);
  if (solved) {
    return "allowed";
  }
  return isDeadEnd ? "disallowed" : "incomplete";
}

/**
 * 手のルール（同じマス・穴）の例の下に出す言葉。どれも今の盤面と直前の手から、本番の判定で出し直す。
 * - `candidates`: 先端の隣の手ごとの印の凡例。触る前の姿と、ほかの言葉に当たらない間。
 * - `solved`: すべてのマスを通った（完成）。
 * - `deadEnd`: すべてのマスを通る前に行き止まりになった。`remaining` は残ったマスの数。
 * - `rejected`: 弾かれて、本番の×が点いている間（`blockedMarkShown`）。`reason` は本番の理由で、例が教えるルールで
 *   弾かれたときも、別の理由のときも同じに言う。×が消えたら、弾かれる前の言葉に戻す。
 * - `rewound`: 道のマスを押して、道がそのマスまで戻った。押したマスへ進んだように見える（✕ の印の通ったマスに先端が乗る、
 *   道の始点を押すと道が消える）ので、進んだのではなく道が戻ったことを言う。来た道をなぞって縮めた手は、先端が来たマスへ
 *   戻るだけなので、凡例のままにする。
 */
export type HitofudePuzzleExampleMoveCaption =
  | { kind: "candidates" }
  | { kind: "solved" }
  | { kind: "deadEnd"; remaining: number }
  | { kind: "rejected"; reason: HitofudePuzzleExtensionRejection }
  | { kind: "rewound" };

export function judgeHitofudePuzzleExampleMove(
  example: HitofudePuzzleExampleBoard,
  { blockedMarkShown }: { blockedMarkShown: boolean },
): HitofudePuzzleExampleMoveCaption {
  const { solved, isDeadEnd } = getHitofudePuzzleExampleStatus(example);
  if (solved) {
    return { kind: "solved" };
  }
  if (isDeadEnd) {
    return {
      kind: "deadEnd",
      remaining: listHitofudePuzzleExampleRemainingCells(example).length,
    };
  }
  const move = example.lastMove;
  if (move?.change === "blocked" && blockedMarkShown) {
    return { kind: "rejected", reason: move.reason };
  }
  const pathMove = example.lastPathMove;
  if (
    pathMove?.change === "shortened" &&
    pathMove.gesture === "press" &&
    isHitofudePuzzleExampleChanged(example)
  ) {
    return { kind: "rewound" };
  }
  return { kind: "candidates" };
}

/** 先端から進める候補のマス1つと、本番の判定で通れるか。通れないときは理由を持つ。 */
export type HitofudePuzzleExampleCandidate = {
  cell: number;
  rejection: HitofudePuzzleExtensionRejection | null;
};

/**
 * 手のルールの例で、手ごとの印を付ける候補のマス。今の先端の上下左右の隣のうち来たマスを除き、本番の延ばす判定で
 * 通れるマスと、例が教えるルール（`rule`）で通れないマスを返す。別の理由で通れないマスと、盤面の端の向きは候補にしない。
 * 完成か行き止まりの盤面では、判定がその姿を言うので空にする。
 */
export function listHitofudePuzzleExampleCandidates(
  example: HitofudePuzzleExampleBoard,
  rule: HitofudePuzzleExtensionRejection,
): HitofudePuzzleExampleCandidate[] {
  const { solved, isDeadEnd } = getHitofudePuzzleExampleStatus(example);
  if (solved || isDeadEnd) {
    return [];
  }
  const board = getHitofudePuzzleExampleBoard(example);
  const path = getHitofudePuzzleExamplePath(example);
  const previous = path.at(-2);
  return listHitofudePuzzleGridNeighbors(
    board.size,
    getHitofudePuzzleHead(example.session.puzzleState),
  )
    .filter((cell) => cell !== previous)
    .map((cell) => {
      const extension = extendHitofudePuzzle(board, { path }, cell);
      return {
        cell,
        rejection: extension.kind === "rejected" ? extension.reason : null,
      };
    })
    .filter(({ rejection }) => rejection === null || rejection === rule);
}
