import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";

/**
 * 例の下に添える言葉。
 * - `outcome`: その手で起きること（どこで止まるか、何が変わるか）。`focus` を渡すと、その変化が起きた手では、止まる所より先にその変化を言う。
 * - `goal`: ゴールで止まったか（✓）、通り過ぎたか（✕）。ゴールに関わらない手では、その手で起きることを言う。
 * - `verdict`: 対で見比べる手のルールで、その手で `move`（もろい岩を崩す・雪を押し出す・塊を押す）ができるか（✓ / ✕）。
 *   そのルールに関わらない手では、その手で起きることを言う。
 * - `cover`: 雪山や塊をゴールへ載せる手。載せた後は、もうそのゴールに止まれないことを ✕ で言う。
 */
export type IceFloorMazeExampleCaptionKind =
  | { kind: "outcome"; focus?: IceFloorMazeExampleEffect }
  | { kind: "goal" }
  | { kind: "verdict"; move: IceFloorMazeExampleMove }
  | { kind: "cover" };

/** 対で見比べる手のルールで、できるかを判定する手。 */
export type IceFloorMazeExampleMove = "crumble" | "push-snow" | "push-block";

/** 1回の滑りで盤面に起きる変化のうち、止まる所のほかに言うもの。`crumble` は、もろい岩が崩れることと、崩れた跡を通り抜けること。 */
export type IceFloorMazeExampleEffect = "crumble" | "crack" | "cover";

/**
 * 触れる例。`hints` は、最初の姿から手がかりで順に示す向き。
 * `goal` の無い例は、ゴールに関わらないルールを見せるので、ゴールの印を描かない。
 */
export type IceFloorMazeHowToPlayExample = {
  board: IceFloorMazeBoard;
  start: number;
  goal: number | null;
  hints: readonly IceFloorMazeDirection[];
  /** 渡さない例（操作の例）は、言葉を添えない。 */
  caption?: IceFloorMazeExampleCaptionKind;
};

/**
 * 盤面の記法（`parseIceFloorMazeBoard`）に、駒の始めのマス `S` とゴール `G` を足した記法で書いた盤面。
 * `S` と `G` は、本番と同じく氷のマスに置く。
 */
function parseMarkedBoard(rows: readonly string[]): {
  board: IceFloorMazeBoard;
  start: number;
  goal: number | null;
} {
  const width = rows[0]?.length ?? 0;
  let start: number | null = null;
  let goal: number | null = null;
  const plainRows = rows.map((row, y) =>
    Array.from(row, (notation, x) => {
      if (notation === "S") {
        start = y * width + x;
        return ".";
      }
      if (notation === "G") {
        goal = y * width + x;
        return ".";
      }
      return notation;
    }).join(""),
  );
  if (start === null) {
    throw new RangeError("How-to-play board needs a start");
  }
  return { board: parseIceFloorMazeBoard(plainRows), start, goal };
}

function defineExample(
  rows: readonly string[],
  hints: readonly IceFloorMazeDirection[],
  caption?: IceFloorMazeExampleCaptionKind,
): IceFloorMazeHowToPlayExample {
  return { ...parseMarkedBoard(rows), hints, caption };
}

/** 盤面に同じ向きの滑りを順に当てた状態。成立しない向きでは状態を変えない。 */
export function applyIceFloorMazeHowToPlayDirections(
  board: IceFloorMazeBoard,
  origin: IceFloorMazeState,
  directions: readonly IceFloorMazeDirection[],
): IceFloorMazeState {
  return directions.reduce((state, direction) => {
    const slide = slideIceFloorMazePiece(board, state, direction);
    return slide.status === "slid"
      ? applyIceFloorMazeSlide(state, slide)
      : state;
  }, origin);
}

/**
 * 入口のゴールの盤面。氷と岩だけの 6×6 で、最短の4手（下・左・上・右）で解く。
 * 1手目でゴールを通り過ぎ、通るだけでは終わらないことも見せ、最後の手で岩の手前のゴールに止まる。
 */
function createGoalFigure() {
  const { board, start, goal } = parseMarkedBoard([
    "...S.#",
    "#.....",
    "..#...",
    "...G#.",
    "......",
    ".#..#.",
  ]);
  if (goal === null) {
    throw new RangeError("How-to-play goal figure needs a goal");
  }
  const solution: readonly IceFloorMazeDirection[] = [
    "down",
    "left",
    "up",
    "right",
  ];
  return { board, start, goal, solution };
}

export const goalFigure = createGoalFigure();

/** 駒は岩か壁にぶつかるまで滑る。右へ滑らせると、岩の手前で止まる。 */
export const slideRuleExample = defineExample(
  [".....", "S..#.", "....."],
  ["right"],
  { kind: "outcome" },
);

/** 岩の手前のゴールで止まる例と、止め役の無いゴールを通り過ぎる例。どちらも右へ滑らせる。 */
export const goalRuleExamples = [
  defineExample(["....", "S.G#", "...."], ["right"], { kind: "goal" }),
  defineExample(["....", "S.G.", "...."], ["right"], { kind: "goal" }),
] as const;

/** 右へ滑らせると床で止まり、もう一度右へ滑らせると床から滑り出して壁の手前で止まる。 */
export const floorRuleExample = defineExample(
  [".....", "S.o..", "....."],
  ["right", "right"],
  { kind: "outcome" },
);

/** 右へ滑らせると薄い氷を通って割り、左へ滑らせ戻すと、割れてできた水面の手前で止まる。 */
export const thinIceRuleExample = defineExample(
  [".....", "Sc...", "....."],
  ["right", "left"],
  { kind: "outcome", focus: "crack" },
);

/**
 * 離れた所から滑ってきて止まるともろい岩が崩れ、もう一度同じ向きへ滑らせると崩れた跡を通り抜ける例と、
 * すぐ隣から向けても崩れない例。
 */
export const brittleRockRuleExamples = [
  defineExample(["....", "S.b.", "...."], ["right", "right"], {
    kind: "verdict",
    move: "crumble",
  }),
  defineExample(["....", ".Sb.", "...."], ["right"], {
    kind: "verdict",
    move: "crumble",
  }),
] as const;

/**
 * 雪を押し出して止まり、もう一度同じ向きへ向けると押し出した雪山で動けない例と、
 * 先に岩がある雪は押し出せずに手前で止まる例。
 */
export const snowRuleExamples = [
  defineExample(["....", "S.s.", "...."], ["right", "right"], {
    kind: "verdict",
    move: "push-snow",
  }),
  defineExample(["....", "S.s#", "...."], ["right"], {
    kind: "verdict",
    move: "push-snow",
  }),
] as const;

/** 離れた所から滑ってきて塊を押す例と、すぐ隣からでは塊が動かない例。 */
export const slidingBlockRuleExamples = [
  defineExample(["....", "S.m.", "...."], ["right"], {
    kind: "verdict",
    move: "push-block",
  }),
  defineExample(["....", ".Sm.", "...."], ["right"], {
    kind: "verdict",
    move: "push-block",
  }),
] as const;

/** 雪をゴールへ押し出して雪山で埋める例と、塊をゴールへ押して載せる例。 */
export const coveredGoalRuleExamples = [
  defineExample(["....", "S.sG", "...."], ["right"], { kind: "cover" }),
  defineExample(["....", "S.mG", "...."], ["right"], { kind: "cover" }),
] as const;

/** スワイプした向きへ滑ることを、右、下の順に試す。 */
export const slideOperationExample = defineExample(
  ["S...", "....", "...."],
  ["right", "down"],
);

/**
 * もうゴールに止まれないことを知らせる盤面。ゴールの先にも隣にも止め役が無く、どう滑ってもゴールを通り過ぎる。
 * ルールの例（`goalRuleExamples` の右）を右へ滑らせ、ゴールを通り過ぎた後の姿。
 * ゴールが雪山で埋まった盤面では、本番と同じくゴールの印を描かず、止まれないわけが図から読めないので使わない。
 */
function createTrappedFigure() {
  const { board, start, goal } = goalRuleExamples[1];
  const direction = "right";
  return {
    board,
    goal,
    state: applyIceFloorMazeHowToPlayDirections(
      board,
      createIceFloorMazeInitialState(board, start),
      [direction],
    ),
    trail: { direction, from: start },
  } as const;
}

export const trappedFigure = createTrappedFigure();
