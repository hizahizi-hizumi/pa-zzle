import {
  formatHakoiriMusumeBoard,
  getHakoiriMusumeCell,
  type HakoiriMusumePiece,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  isHakoiriMusumeCleared,
  moveHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `slide`: 駒は、空いたマスへだけ動かせる。
 * - `block`: 駒はほかの駒を通り抜けられないので、道をふさぐ駒を先にどかす。
 *
 * 同じ駒なら続けて動かしても1手と数えることは、手を決めるルールではなく手数の数え方なので、ルールの並びには置かず、
 * 2つ目の手順の一言で伝えて、その場で同じ駒を続けて動かさせる。
 */
export type HakoiriMusumeTutorialRuleId = "slide" | "block";

/**
 * 利用者の1回の操作。
 * - `move`: 盤面と同じく、何番目の駒をどちらへ1マス動かそうとしたか。なぞりの途中でも、駒が1マス移るたびに1回届く。
 * - `push`: 指で駒を動かそうとしたが、その向きがふさがれていて駒が動かなかった。
 */
export type HakoiriMusumeTutorialAction =
  | { type: "move"; pieceIndex: number; direction: HakoiriMusumeDirection }
  | { type: "push"; pieceIndex: number; direction: HakoiriMusumeDirection };

/**
 * 手順を終えたとみなす操作。
 * - `reach`: 印の駒の左上が `cells` のどれかに着く。
 * - `push`: 印の駒を `direction` へ動かそうとして、ふさがれて動かない。
 */
export type HakoiriMusumeTutorialStepGoal =
  | { type: "reach"; cells: readonly number[] }
  | { type: "push"; direction: HakoiriMusumeDirection };

/**
 * 手順で印を付けて動かさせる駒。
 * - `pieceIndex`: 印を付け、手順の間だけ受け付ける駒。
 * - `goal`: 手順を終えたとみなす操作。
 * - `targetCells`: 行き先として覆いから抜いて見せるマス。行き先を見せない手順では空。
 * - `deciderPieceIndices`: 印の駒をそう動かす手を決める駒（決め手）。空いたマスで手が決まる手順では空。
 * - `doneMessage`: 手順を終えた後、次の手順へ進む前に出す一言。終えた手が何を示したかを言う。無ければ手順の一言のまま。
 * - `stray`: 印の駒が `cells` のどれかに止まったときに、手順の一言の代わりに出す一言。手順の行き先から外れたわけを言う。
 */
export type HakoiriMusumeTutorialStep =
  TutorialStep<HakoiriMusumeTutorialRuleId> & {
    pieceIndex: number;
    goal: HakoiriMusumeTutorialStepGoal;
    targetCells: readonly number[];
    deciderPieceIndices: readonly number[];
    doneMessage: TutorialMessage | null;
    stray: { cells: readonly number[]; message: TutorialMessage } | null;
  };

/** 駒が1マス移った手。`from` と `to` は駒の左上のマス。 */
export type HakoiriMusumeTutorialMove = {
  pieceIndex: number;
  from: number;
  to: number;
};

/**
 * - `puzzle`: 盤面。本番と同じ `puzzle/` の遷移で進める。手数は数えない（チュートリアルでは手数を出さない）。
 * - `stepCount`: 駒が1マス移った回数。効果音と合図をやり直す目印に使う。
 */
export type HakoiriMusumeTutorialBoardState = {
  puzzle: HakoiriMusumeState;
  stepCount: number;
  lastMove: HakoiriMusumeTutorialMove | null;
};

type HakoiriMusumeTutorialSituation = TutorialSituation<
  HakoiriMusumeTutorialRuleId,
  HakoiriMusumeTutorialStep
>;

function parseBoard(rows: readonly string[]): HakoiriMusumePiece[] {
  const pieces = parseHakoiriMusumeBoard(rows.join(""));
  if (!pieces) {
    throw new Error(`盤面の書き方が合わない: ${rows.join("/")}`);
  }
  return pieces;
}

/**
 * 娘と、横長1つ・縦長2つ・小駒2つ。最短は5手。駒の番号は左上のマスの順で、0 が娘、1 が3行4列の小駒、2 が横長、3 が4行3列の縦長。
 * 3行4列の小駒は、空いているのが上だけなので上へ、続けてまた上へ動かすと、同じ駒の続けての移動の1手でゴールと同じ所へ収まる。
 * そのとき横長は、上を娘にふさがれ、右は縦長、下は小駒で、どの向きへも動かせない。娘を右へどかすと横長の上が空く。
 * 横長を上げ、縦長を左上へ回し、娘を下ろす3手が残る。
 *
 * ```text
 * 最初    ゴール
 * . . . . h i . s
 * . A A . v . . .
 * . A A s w . . .
 * h i v v . A A v
 * s . w w s A A w
 * ```
 */
const startPieces = parseBoard(["....", ".AA.", ".AAs", "hivv", "s.ww"]);
const goalPieces = parseBoard(["hi.s", "v...", "w...", ".AAv", "sAAw"]);

const DAUGHTER_INDEX = 0;
const GUIDED_SMALL_INDEX = 1;
const HORIZONTAL_INDEX = 2;

function cellAt(row: number, column: number): number {
  return getHakoiriMusumeCell({ row, column });
}

/**
 * 3行4列の小駒を、空いた上へ動かして操作を見せ、続けてまた上へ動かさせて、同じ駒を続けて動かすと1手と数えることを伝える。
 * 次に、横長を上へ動かそうとさせ、娘にふさがれて動かないことを体で知らせる（横長はほかの向きへも動かせない）。
 * 最後に、娘をどかさせる。横長の上が空く所へ動かしたところで手を離す。左へどかしても横長の上は空かないので、そのわけを言う。
 */
const steps: readonly HakoiriMusumeTutorialStep[] = [
  {
    message: { headline: "この駒を\n上へ動かしてみましょう", detail: null },
    introducedRuleId: "slide",
    pieceIndex: GUIDED_SMALL_INDEX,
    goal: { type: "reach", cells: [cellAt(1, 3)] },
    targetCells: [cellAt(1, 3)],
    deciderPieceIndices: [],
    doneMessage: { headline: "空いたマスへ\nすべります", detail: null },
    stray: null,
  },
  {
    message: {
      headline: "続けて上へ\n動かしましょう",
      detail: "同じ駒を続けて動かすと、1手と数えます",
    },
    introducedRuleId: null,
    pieceIndex: GUIDED_SMALL_INDEX,
    goal: { type: "reach", cells: [cellAt(0, 3)] },
    targetCells: [cellAt(0, 3)],
    deciderPieceIndices: [],
    doneMessage: { headline: "上へ2マスで\nまとめて1手です", detail: null },
    stray: {
      cells: [cellAt(2, 3)],
      message: { headline: "上へ\n動かしましょう", detail: null },
    },
  },
  {
    message: { headline: "横長の駒を\n上へ動かしてみましょう", detail: null },
    introducedRuleId: "block",
    pieceIndex: HORIZONTAL_INDEX,
    goal: { type: "push", direction: "up" },
    targetCells: [],
    deciderPieceIndices: [DAUGHTER_INDEX],
    doneMessage: {
      headline: "娘にふさがれて\n上へ動かせません",
      detail: "駒は、ほかの駒を通り抜けられません",
    },
    stray: null,
  },
  {
    message: {
      headline: "娘を右へ\nどかしましょう",
      detail: "横長の駒の上が空きます",
    },
    introducedRuleId: null,
    pieceIndex: DAUGHTER_INDEX,
    goal: { type: "reach", cells: [cellAt(0, 0), cellAt(0, 1), cellAt(1, 2)] },
    targetCells: [],
    deciderPieceIndices: [HORIZONTAL_INDEX],
    doneMessage: null,
    stray: {
      cells: [cellAt(1, 0)],
      message: {
        headline: "左だと、横長の駒の上が\n空きません",
        detail: "右へどかしましょう",
      },
    },
  },
];

function createBoardState(
  pieces: readonly HakoiriMusumePiece[],
): HakoiriMusumeTutorialBoardState {
  return {
    puzzle: createHakoiriMusumeInitialState(pieces),
    stepCount: 0,
    lastMove: null,
  };
}

function startHakoiriMusumeTutorial(): HakoiriMusumeTutorialBoardState {
  return createBoardState(startPieces);
}

function getHakoiriMusumeTutorialGoal(): HakoiriMusumeTutorialBoardState {
  return createBoardState(goalPieces);
}

/** 今の盤面。 */
export function getHakoiriMusumeTutorialPuzzle({
  puzzle,
}: HakoiriMusumeTutorialBoardState): HakoiriMusumeState {
  return puzzle;
}

/** 手順が求める、ふさがれた向きへの操作か。キーボードの矢印でふさがれた向きへ動かそうとした手も含める。 */
function isRequiredPush(
  step: HakoiriMusumeTutorialStep,
  { puzzle }: HakoiriMusumeTutorialBoardState,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
): boolean {
  return (
    step.goal.type === "push" &&
    pieceIndex === step.pieceIndex &&
    direction === step.goal.direction &&
    moveHakoiriMusumePiece(puzzle, pieceIndex, direction) === null
  );
}

/**
 * 手を引いている間は、印の駒だけを受け付ける。印の駒が手順の行き先に着くか、手順が求める向きへ動かそうとしてふさがれると、
 * 次の手順へ進む。手を離した後は本番と同じく、どの駒も受け付ける。盤面は本番と同じ `puzzle/` の遷移で進め、
 * ふさがれた向きへの手は本番と同じく何も起きない。
 */
function performHakoiriMusumeTutorialAction(
  { step }: HakoiriMusumeTutorialSituation,
  state: HakoiriMusumeTutorialBoardState,
  { type, pieceIndex, direction }: HakoiriMusumeTutorialAction,
): { state: HakoiriMusumeTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (step !== null && isRequiredPush(step, state, pieceIndex, direction)) {
    return { state, outcome: "stepped" };
  }
  if (type === "push" || (step !== null && pieceIndex !== step.pieceIndex)) {
    return { state, outcome: "ignored" };
  }
  const puzzle = moveHakoiriMusumePiece(state.puzzle, pieceIndex, direction);
  if (!puzzle) {
    return { state, outcome: "ignored" };
  }
  const to = puzzle.pieces[pieceIndex]!.cell;
  const next: HakoiriMusumeTutorialBoardState = {
    puzzle,
    stepCount: state.stepCount + 1,
    lastMove: { pieceIndex, from: state.puzzle.pieces[pieceIndex]!.cell, to },
  };
  if (isHakoiriMusumeCleared(puzzle)) {
    return { state: next, outcome: "solved" };
  }
  const reached = step?.goal.type === "reach" && step.goal.cells.includes(to);
  return { state: next, outcome: reached ? "stepped" : "continued" };
}

/** ルールに合わない手は盤面が受け付けないので、違反は起きない。今の一言をそのまま返す。 */
function describeHakoiriMusumeTutorialViolation({
  step,
}: HakoiriMusumeTutorialSituation): TutorialMessage {
  return step?.message ?? hakoiriMusumeTutorial.freePlay;
}

/** 1つの駒を1手で動かした後の盤面すべて。1手で駒が行ける所は、ほかの駒を動かさずに空いたマスを1マスずつたどれる所。 */
function listOneHandStates(
  state: HakoiriMusumeState,
  pieceIndex: number,
): HakoiriMusumeState[] {
  const reached = new Set([state.pieces[pieceIndex]!.cell]);
  const queue = [state];
  for (let head = 0; head < queue.length; head += 1) {
    for (const direction of hakoiriMusumeDirections) {
      const moved = moveHakoiriMusumePiece(queue[head]!, pieceIndex, direction);
      const cell = moved?.pieces[pieceIndex]?.cell;
      if (moved && cell !== undefined && !reached.has(cell)) {
        reached.add(cell);
        queue.push(moved);
      }
    }
  }
  return queue.slice(1);
}

/**
 * 今の盤面から、本番と同じく1つの駒の続けての移動を1手として、娘を出口の前へ運ぶ最も少ない手数の動かし方の、最初に動かす駒。
 * 解き終えていれば `null`。同じ種類の駒どうしが入れ替わっただけの盤面は同じとみなして、手ごとの幅優先でたどる。
 */
function findFirstPieceOfFewestHands(start: HakoiriMusumeState): number | null {
  if (isHakoiriMusumeCleared(start)) {
    return null;
  }
  const visited = new Set([formatHakoiriMusumeBoard(start.pieces)]);
  let layer: { state: HakoiriMusumeState; firstPieceIndex: number | null }[] = [
    { state: start, firstPieceIndex: null },
  ];
  while (layer.length > 0) {
    const next: typeof layer = [];
    for (const { state, firstPieceIndex } of layer) {
      for (
        let pieceIndex = 0;
        pieceIndex < state.pieces.length;
        pieceIndex += 1
      ) {
        const first = firstPieceIndex ?? pieceIndex;
        for (const moved of listOneHandStates(state, pieceIndex)) {
          if (isHakoiriMusumeCleared(moved)) {
            return first;
          }
          const key = formatHakoiriMusumeBoard(moved.pieces);
          if (!visited.has(key)) {
            visited.add(key);
            next.push({ state: moved, firstPieceIndex: first });
          }
        }
      }
    }
    layer = next;
  }
  return null;
}

/** 手順で印を付ける駒。手を離した後は `null`。 */
export function getHakoiriMusumeTutorialStepPiece({
  step,
}: HakoiriMusumeTutorialSituation): number | null {
  return step?.pieceIndex ?? null;
}

/** 手を引いている間の決め手の駒。手を離した後は空。 */
export function listHakoiriMusumeTutorialDeciderPieces({
  step,
}: HakoiriMusumeTutorialSituation): readonly number[] {
  return step?.deciderPieceIndices ?? [];
}

/** 手順の行き先として覆いから抜いて見せるマス。手を離した後は空。 */
export function listHakoiriMusumeTutorialTargetCells({
  step,
}: HakoiriMusumeTutorialSituation): readonly number[] {
  return step?.targetCells ?? [];
}

/** 手順の一言。印の駒が手順の行き先から外れた所に止まっていれば、そのわけを言う一言。手を離した後は `null`。 */
export function describeHakoiriMusumeTutorialStep(
  { step }: HakoiriMusumeTutorialSituation,
  state: HakoiriMusumeTutorialBoardState,
): TutorialMessage | null {
  if (step === null) {
    return null;
  }
  const cell =
    getHakoiriMusumeTutorialPuzzle(state).pieces[step.pieceIndex]!.cell;
  return step.stray?.cells.includes(cell) ? step.stray.message : step.message;
}

/** 手が止まったときに、次に動かす駒の印に添える一言。 */
export const hakoiriMusumeTutorialHintMessage: TutorialMessage = {
  headline: "次はこの駒を\n動かしましょう",
  detail: null,
};

/** 手を離した後、手が止まったときに示す、次に動かす駒。解き終えていれば `null`。 */
export function findHakoiriMusumeTutorialHintPiece(
  state: HakoiriMusumeTutorialBoardState,
): number | null {
  return findFirstPieceOfFewestHands(getHakoiriMusumeTutorialPuzzle(state));
}

export const hakoiriMusumeTutorial: Tutorial<
  HakoiriMusumeTutorialRuleId,
  HakoiriMusumeTutorialStep,
  HakoiriMusumeTutorialBoardState,
  HakoiriMusumeTutorialAction
> = {
  intro: {
    purpose: "娘を出口の前まで\n運ぶパズルです",
    goalCaption: "ここまで運べば完成です",
    startCaption: "ほかの駒が\n道をふさいでいます",
  },
  rules: [
    { id: "slide", label: "空いたマスへ動かす" },
    { id: "block", label: "通り抜けられない" },
  ],
  steps,
  freePlay: {
    headline: "ここからは自分で\n娘を出口の前まで運びましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "少ない手数で速く解くほど\n点が上がります",
    },
    play: {
      headline: "完成です",
      detail: "少ない手数で速く解くほど\n点が上がります",
    },
  },
  start: startHakoiriMusumeTutorial,
  goal: getHakoiriMusumeTutorialGoal,
  perform: performHakoiriMusumeTutorialAction,
  describeViolation: describeHakoiriMusumeTutorialViolation,
};

export const _private = {
  startPieces,
  goalPieces,
  findFirstPieceOfFewestHands,
  listOneHandStates,
};
