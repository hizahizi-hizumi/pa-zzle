import {
  applyIceFloorMazeSlide,
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
  isSameIceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import {
  applyIceFloorMazeHowToPlayDirections,
  type IceFloorMazeExampleCaptionKind,
  type IceFloorMazeExampleEffect,
  type IceFloorMazeExampleMove,
  type IceFloorMazeHowToPlayExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";

type IceFloorMazeSlid = Extract<IceFloorMazeSlide, { status: "slid" }>;

/**
 * 例に打った手。`before` は手を打つ前の状態。
 * - `slid`: 1マス以上滑った。
 * - `blocked`: すぐ隣が止め役か壁で、1マスも動けなかった。盤面は変わらない。
 */
type IceFloorMazeExampleInput =
  | { kind: "slid"; slide: IceFloorMazeSlid; before: IceFloorMazeState }
  | {
      kind: "blocked";
      slide: Extract<IceFloorMazeSlide, { status: "blocked" }>;
      before: IceFloorMazeState;
    };

/** 触れる例の今の姿。`lastInput` は最後に打った手で、まだ打っていなければ `null`。 */
export type IceFloorMazeExampleBoard = {
  example: IceFloorMazeHowToPlayExample;
  state: IceFloorMazeState;
  lastInput: IceFloorMazeExampleInput | null;
};

/** 例の下の言葉。`mark` は、判定を言う言葉（ゴール・崩す・押し出す・押す・ゴールをふさぐ）の ✓（`allowed`）と ✕（`disallowed`）で、ほかは `null`。 */
export type IceFloorMazeExampleCaption = {
  mark: "allowed" | "disallowed" | null;
  text: string;
};

function createInitialState(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeState {
  return createIceFloorMazeInitialState(example.board, example.start);
}

export function createIceFloorMazeExampleBoard(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeExampleBoard {
  return { example, state: createInitialState(example), lastInput: null };
}

export function isIceFloorMazeExampleCleared({
  example,
  state,
}: IceFloorMazeExampleBoard): boolean {
  return (
    example.goal !== null && isIceFloorMazeCleared(state.position, example.goal)
  );
}

export function isIceFloorMazeExampleChanged({
  example,
  state,
}: IceFloorMazeExampleBoard): boolean {
  return !isSameIceFloorMazeState(state, createInitialState(example));
}

function attemptSlide(
  example: IceFloorMazeHowToPlayExample,
  state: IceFloorMazeState,
  direction: IceFloorMazeDirection,
): IceFloorMazeExampleInput {
  const slide = slideIceFloorMazePiece(example.board, state, direction);
  return slide.status === "slid"
    ? { kind: "slid", slide, before: state }
    : { kind: "blocked", slide, before: state };
}

/** 本番と同じく、ゴールで止まった後は受け付けない。 */
export function slideIceFloorMazeExample(
  current: IceFloorMazeExampleBoard,
  direction: IceFloorMazeDirection,
): IceFloorMazeExampleBoard {
  if (isIceFloorMazeExampleCleared(current)) {
    return current;
  }
  const input = attemptSlide(current.example, current.state, direction);
  return {
    ...current,
    state:
      input.kind === "slid"
        ? applyIceFloorMazeSlide(current.state, input.slide)
        : current.state,
    lastInput: input,
  };
}

/** 手がかりの各手を打つ前の状態。`hints` と同じ順に並ぶ。 */
function listHintStates(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeState[] {
  const origin = createInitialState(example);
  return example.hints.map((_, index) =>
    applyIceFloorMazeHowToPlayDirections(
      example.board,
      origin,
      example.hints.slice(0, index),
    ),
  );
}

/**
 * 次に滑らせる向きの手がかり。今の姿が、手がかりの手を順に打っていく途中の姿のときだけ、その次の向きを返す。
 * 動けなかった手の後は、盤面が変わるまで返さない。ゴールで止まった後と、手がかりの手を打ち終えた後も返さない。
 */
export function findIceFloorMazeExampleHint(
  board: IceFloorMazeExampleBoard,
): IceFloorMazeDirection | null {
  if (
    isIceFloorMazeExampleCleared(board) ||
    board.lastInput?.kind === "blocked"
  ) {
    return null;
  }
  const hintStates = listHintStates(board.example);
  for (let index = hintStates.length - 1; index >= 0; index -= 1) {
    if (isSameIceFloorMazeState(board.state, hintStates[index]!)) {
      return board.example.hints[index] ?? null;
    }
  }
  return null;
}

/** 今の姿から、その向きへ1マスも動けないか。手がかりの矢印を、すぐ隣の止め役に重ねずに描くのに使う。 */
export function isIceFloorMazeExampleBlocked(
  board: IceFloorMazeExampleBoard,
  direction: IceFloorMazeDirection,
): boolean {
  return attemptSlide(board.example, board.state, direction).kind === "blocked";
}

/** 止め役の呼び名。外周の外壁と盤面の外は、どちらも壁と呼ぶ。 */
function nameStopper(state: IceFloorMazeState, cell: number | null): string {
  if (cell === null) {
    return "壁";
  }
  if (state.blocks.includes(cell)) {
    return "塊";
  }
  switch (state.cells[cell]) {
    case "rock":
      return "岩";
    case "brittle-rock":
      return "もろい岩";
    case "water":
      return "水面";
    case "snow":
      return "雪";
    case "snow-mound":
      return "雪山";
    default:
      return "壁";
  }
}

/** 駒がどこでどう止まるか。 */
function describeStop(
  example: IceFloorMazeHowToPlayExample,
  { slide, before }: Extract<IceFloorMazeExampleInput, { kind: "slid" }>,
): string {
  if (slide.pushedSnow) {
    return "雪を押し出して止まる";
  }
  if (slide.movedBlock) {
    return "塊を押して止まる";
  }
  if (slide.to === example.goal) {
    return "ゴールで止まる";
  }
  if (example.board.cells[slide.to] === "floor") {
    return "床で止まる";
  }
  const stopper = getIceFloorMazeNeighbor(
    example.board,
    slide.to,
    slide.direction,
  );
  return `${nameStopper(before, stopper)}の手前で止まる`;
}

/**
 * 止まる所のほかに、その滑りで盤面に起きる変化と、崩れた跡を通り抜けたこと。
 * ゴールを通り過ぎたことは、ゴールのルールの例だけが判定で言う。ほかの例では教えるルールと別のことで、言葉を長くするので言わない。
 */
function listEffects(
  example: IceFloorMazeHowToPlayExample,
  { slide, before }: Extract<IceFloorMazeExampleInput, { kind: "slid" }>,
): { effect: IceFloorMazeExampleEffect; text: string }[] {
  const { board, goal } = example;
  const passedRubble = slide.path.some(
    (cell) =>
      board.cells[cell] === "brittle-rock" && before.cells[cell] === "ice",
  );
  return [
    ...(slide.crumbledRock !== null
      ? [{ effect: "crumble", text: "もろい岩が崩れる" } as const]
      : []),
    ...(passedRubble
      ? [{ effect: "crumble", text: "崩れた跡を通り抜ける" } as const]
      : []),
    ...(slide.crackedIce.length > 0
      ? [{ effect: "crack", text: "薄い氷が割れる" } as const]
      : []),
    ...(slide.pushedSnow !== null && slide.pushedSnow.to === goal
      ? [{ effect: "cover", text: "雪山がゴールに載る" } as const]
      : []),
    ...(slide.movedBlock !== null && slide.movedBlock.to === goal
      ? [{ effect: "cover", text: "塊がゴールに載る" } as const]
      : []),
  ];
}

/** 動けなかった手で、向けた先の物が動かないこと。崩れる・動くと思われる物だけを言う。 */
function describeHeldStopper(
  example: IceFloorMazeHowToPlayExample,
  {
    slide: { direction },
    before,
  }: Extract<IceFloorMazeExampleInput, { kind: "blocked" }>,
): string | null {
  const stopper = getIceFloorMazeNeighbor(
    example.board,
    before.position,
    direction,
  );
  if (stopper === null) {
    return null;
  }
  if (before.blocks.includes(stopper)) {
    return "塊は動かない";
  }
  switch (before.cells[stopper]) {
    case "brittle-rock":
      return "もろい岩は崩れない";
    case "snow":
      return "雪は動かない";
    case "snow-mound":
      return "雪山は動かない";
    default:
      return null;
  }
}

/** その手で起きること。`focus` の変化が起きた手では、その変化を先に言い、止まる所は言わない。 */
function describeOutcome(
  example: IceFloorMazeHowToPlayExample,
  input: IceFloorMazeExampleInput,
  focus: IceFloorMazeExampleEffect | undefined,
): string {
  if (input.kind === "blocked") {
    return ["動けない", describeHeldStopper(example, input)]
      .filter((text) => text !== null)
      .join("・");
  }
  const effects = listEffects(example, input);
  const focused = effects.filter(({ effect }) => effect === focus);
  const others = effects.filter(({ effect }) => effect !== focus);
  const lead =
    focused.length > 0
      ? focused.map(({ text }) => text)
      : [describeStop(example, input)];
  return [...lead, ...others.map(({ text }) => text)].join("・");
}

/**
 * ゴールのルールの言葉。試す前は、手がかりの手がゴールで止まるか通り過ぎるかを言い、試した後は、ゴールで止まれば完成、
 * 通り過ぎたらそのことを言う。ゴールに関わらない手の後は、その手で起きることを言う。
 */
function describeGoalInput(
  example: IceFloorMazeHowToPlayExample,
  input: IceFloorMazeExampleInput,
  tried: boolean,
): IceFloorMazeExampleCaption {
  if (input.kind === "slid" && input.slide.to === example.goal) {
    return { mark: "allowed", text: tried ? "完成" : "ゴールで止まる" };
  }
  if (
    input.kind === "slid" &&
    example.goal !== null &&
    doesIceFloorMazeSlidePassGoal(input.slide, example.goal)
  ) {
    return { mark: "disallowed", text: tried ? "通り過ぎた" : "通り過ぎる" };
  }
  return { mark: null, text: describeOutcome(example, input, undefined) };
}

/**
 * 対で見比べる手のルールの言葉。手の動詞で、試す前はできるか（崩せる・押し出せる・押せる）を、試した後は試した手の結果
 * （崩せた・押し出せた・押せた）を言う。できないことは、試す前も後も同じ言葉で言う。
 */
const moveVerdictLabels = {
  crumble: { allowed: "崩せる", tried: "崩せた", disallowed: "崩せない" },
  "push-snow": {
    allowed: "押し出せる",
    tried: "押し出せた",
    disallowed: "押し出せない",
  },
  "push-block": { allowed: "押せる", tried: "押せた", disallowed: "押せない" },
} as const satisfies Record<
  IceFloorMazeExampleMove,
  { allowed: string; tried: string; disallowed: string }
>;

/** 止め役として向けた先か、止まった手前の物。動けなかった手ではすぐ隣、滑った手では止まったマスの先。 */
function findFacedCell(
  example: IceFloorMazeHowToPlayExample,
  input: IceFloorMazeExampleInput,
): number | null {
  const from =
    input.kind === "blocked" ? input.before.position : input.slide.to;
  return getIceFloorMazeNeighbor(example.board, from, input.slide.direction);
}

/**
 * その手で `move` ができたか。できた・できなかったのどちらでもない手（ルールに関わらない手）では `null`。
 * - もろい岩: 滑ってきて崩したらできた。すぐ隣のもろい岩へ向けたらできない。
 * - 雪: 押し出したらできた。押し出せない雪の手前で止まるか、すぐ隣の雪・雪山へ向けたらできない。
 * - 塊: 押して動かしたらできた。動かない塊の手前で止まるか、すぐ隣の塊へ向けたらできない。
 */
function judgeMove(
  example: IceFloorMazeHowToPlayExample,
  move: IceFloorMazeExampleMove,
  input: IceFloorMazeExampleInput,
): boolean | null {
  if (input.kind === "slid") {
    const done =
      move === "crumble"
        ? input.slide.crumbledRock !== null
        : move === "push-snow"
          ? input.slide.pushedSnow !== null
          : input.slide.movedBlock !== null;
    if (done) {
      return true;
    }
  }
  const faced = findFacedCell(example, input);
  if (faced === null) {
    return null;
  }
  const { before } = input;
  const facedCell = before.cells[faced];
  const facing =
    move === "crumble"
      ? input.kind === "blocked" && facedCell === "brittle-rock"
      : move === "push-snow"
        ? facedCell === "snow" || facedCell === "snow-mound"
        : before.blocks.includes(faced);
  return facing ? false : null;
}

function describeMoveVerdict(
  example: IceFloorMazeHowToPlayExample,
  move: IceFloorMazeExampleMove,
  input: IceFloorMazeExampleInput,
  tried: boolean,
): IceFloorMazeExampleCaption {
  const judged = judgeMove(example, move, input);
  const labels = moveVerdictLabels[move];
  if (judged === true) {
    return { mark: "allowed", text: tried ? labels.tried : labels.allowed };
  }
  if (judged === false) {
    return { mark: "disallowed", text: labels.disallowed };
  }
  return {
    mark: null,
    text: describeOutcome(
      example,
      input,
      move === "crumble" ? "crumble" : undefined,
    ),
  };
}

/**
 * 雪山や塊をゴールへ載せるルールの言葉。試す前は載せることを言い、載せた後は、もうそのゴールに止まれないことを ✕ で言う。
 * 本番の盤面はゴールに載った物の下にゴールの印を描かないので、ゴールがふさがったことを言葉に残す。
 */
function describeCover(
  example: IceFloorMazeHowToPlayExample,
  input: IceFloorMazeExampleInput,
  tried: boolean,
): IceFloorMazeExampleCaption {
  const covered =
    input.kind === "slid" &&
    listEffects(example, input).some(({ effect }) => effect === "cover");
  if (covered && tried) {
    return { mark: "disallowed", text: "ゴールに止まれない" };
  }
  return { mark: null, text: describeOutcome(example, input, "cover") };
}

function describeInput(
  example: IceFloorMazeHowToPlayExample,
  caption: IceFloorMazeExampleCaptionKind,
  input: IceFloorMazeExampleInput,
  tried: boolean,
): IceFloorMazeExampleCaption {
  switch (caption.kind) {
    case "goal":
      return describeGoalInput(example, input, tried);
    case "verdict":
      return describeMoveVerdict(example, caption.move, input, tried);
    case "cover":
      return describeCover(example, input, tried);
    case "outcome":
      return {
        mark: null,
        text: describeOutcome(example, input, caption.focus),
      };
  }
}

/**
 * 例の下の言葉。手を打つ前は、手がかりの最初の手で起きることを言う。打った後は、最後に打った手で起きたことを言う。
 * 言葉を添えない例（操作の例）では `null`。
 */
export function describeIceFloorMazeExample(
  board: IceFloorMazeExampleBoard,
): IceFloorMazeExampleCaption | null {
  const { example, lastInput } = board;
  const { caption } = example;
  const [firstHint] = example.hints;
  if (caption === undefined || firstHint === undefined) {
    return null;
  }
  if (lastInput !== null) {
    return describeInput(example, caption, lastInput, true);
  }
  return describeInput(
    example,
    caption,
    attemptSlide(example, board.state, firstHint),
    false,
  );
}

/**
 * 例で出しうる言葉のすべて。最初の姿から移れるどの状態でどの向きへ滑らせたときの言葉も含む。
 * 言葉を入れ替えても周りを動かさないよう、いちばん長い言葉の場所を取るのに使う。
 */
export function listIceFloorMazeExampleCaptions(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeExampleCaption[] {
  const { caption } = example;
  const initial = createIceFloorMazeExampleBoard(example);
  const first = describeIceFloorMazeExample(initial);
  if (caption === undefined || first === null) {
    return [];
  }
  const graph = exploreIceFloorMazeStates(
    example.board,
    initial.state,
    example.goal === null ? {} : { goal: example.goal },
  );
  const states = graph?.states ?? [initial.state];
  const captions = [
    first,
    ...states.flatMap((state) =>
      example.goal !== null && state.position === example.goal
        ? []
        : iceFloorMazeDirections.map((direction) =>
            describeInput(
              example,
              caption,
              attemptSlide(example, state, direction),
              true,
            ),
          ),
    ),
  ];
  const seen = new Set<string>();
  return captions.filter(({ mark, text }) => {
    const key = `${mark}:${text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
