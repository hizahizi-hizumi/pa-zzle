import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import type {
  ShuttleParkingCarId,
  ShuttleParkingColor,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  isShuttleParkingStuck,
  type ShuttleParkingBoardingEvent,
  type ShuttleParkingExitBlock,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `board`: 乗客は列の先頭から順に、同じ色の待っている車へ1人ずつ乗り、席が埋まった車は出発する。
 * - `path`: 前に車があると出られない。
 * - `bays`: 待機枠が埋まると次の車を出せないので、先頭の乗客が乗れる車を出す。
 * - `sameColor`: 同じ色の車が2台待っていれば、先に入った車から乗る。手順は足さず、解き終えたときの振り返りでだけ見せる
 *   （上のレベルでは、どちらの車に乗るかを読んで出す順を決める）。
 */
export type ShuttleParkingTutorialRuleId =
  | "board"
  | "path"
  | "bays"
  | "sameColor";

/** 車を押すか、詰んだときに「待った」で1台戻す。 */
export type ShuttleParkingTutorialAction =
  | { type: "exit"; carId: ShuttleParkingCarId }
  | { type: "undo" };

/** `carId` は印を付けて押させる車。読みの手順では `null` で、どの車を出すかを自分で選ばせる。 */
export type ShuttleParkingTutorialStep =
  TutorialStep<ShuttleParkingTutorialRuleId> & {
    carId: ShuttleParkingCarId | null;
  };

/**
 * 直前の手。盤面の動きと一言に使う。
 * - `exited`: 車を出した。`before` は出す前の盤面。`stuck` は出した後に出せる車が無くなったか。
 * - `blocked`: 出せない車を押した。盤面は変わらない。
 * - `off-step`: 印と違う車を押した。盤面は変わらない。
 * - `undone`: 「待った」で1台戻した。
 */
export type ShuttleParkingTutorialMove =
  | {
      type: "exited";
      id: number;
      carId: ShuttleParkingCarId;
      side: ShuttleParkingSide;
      before: ShuttleParkingState;
      events: readonly ShuttleParkingBoardingEvent[];
      stuck: boolean;
    }
  | ({
      type: "blocked";
      id: number;
      carId: ShuttleParkingCarId;
    } & ShuttleParkingExitBlock)
  | { type: "off-step"; id: number; carId: ShuttleParkingCarId }
  | { type: "undone"; id: number };

/** `history` は出す前の盤面を出した順に並べたもの。「待った」で戻すのに使う。 */
export type ShuttleParkingTutorialBoardState = {
  state: ShuttleParkingState;
  history: readonly ShuttleParkingState[];
  lastMove: ShuttleParkingTutorialMove | null;
};

export type ShuttleParkingTutorialSituation = TutorialSituation<
  ShuttleParkingTutorialRuleId,
  ShuttleParkingTutorialStep
>;

/**
 * 5×5 で上だけが開いた駐車場に6台。待機枠は2つ。
 *
 * ```text
 *  vvvvv     車0 赤3人  車1 青2人（車0の後ろ）  車2 黄3人（車5の後ろ）
 * 450..     車3 黄3人  車4 黄2人  車5 黄2人
 * 450..     列: 黄 黄 黄 赤 黄 黄 赤 黄 黄 赤 青 黄 青 黄 黄
 * .203.
 * .213.
 * .213.
 * ```
 *
 * 車5（黄）を出すと先頭の黄2人が乗って出発し、塞がれていた車2が出られる。車2を出すと黄が1人乗って待つ。
 * 次の先頭は赤なので、ここで車0（赤）を出すと続けられ、黄の車3・4を出すと待機枠が埋まって詰む。
 * 車0を出した後は先頭が黄になり、青の車1を先に出すとまた詰む。先頭に合わせて黄・青・黄の順に出すと全員を送り出せる。
 */
export const shuttleParkingTutorialProblem: ShuttleParkingProblem = {
  lot: {
    size: 5,
    openSides: ["top"],
    cars: [
      { row: 0, column: 2, orientation: "vertical", capacity: 3, color: "a" },
      { row: 3, column: 2, orientation: "vertical", capacity: 2, color: "b" },
      { row: 2, column: 1, orientation: "vertical", capacity: 3, color: "c" },
      { row: 2, column: 3, orientation: "vertical", capacity: 3, color: "c" },
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "c" },
      { row: 0, column: 1, orientation: "vertical", capacity: 2, color: "c" },
    ],
  },
  passengers: Array.from("cccaccaccabcbcc") as ShuttleParkingColor[],
  bayCount: 2,
};

/** 先頭に合わせて出していく、ゴールまでの順。 */
export const SHUTTLE_PARKING_TUTORIAL_SOLUTION = [5, 2, 0, 3, 1, 4] as const;

const steps: readonly ShuttleParkingTutorialStep[] = [
  {
    message: {
      headline: "車をタップして待機枠へ出します",
      detail: "列の先頭から順に同じ色の乗客が乗ります",
    },
    introducedRuleId: "board",
    carId: 5,
  },
  {
    message: {
      headline: "前に車があると出られません\n前が空いた黄の車を出します",
      detail: null,
    },
    introducedRuleId: "path",
    carId: 2,
  },
  {
    message: {
      headline: "待機枠は2台までです\n先頭の乗客が乗れる車を選んで出します",
      detail: "埋まると次の車を出せません",
    },
    introducedRuleId: "bays",
    carId: null,
  },
];

/** 印を付けて出させる車の数。この分は「待った」で戻させない。 */
const GUIDED_EXIT_COUNT = steps.filter(({ carId }) => carId !== null).length;

const clearability = createShuttleParkingClearability(
  shuttleParkingTutorialProblem,
);

function createGoalState(): ShuttleParkingState {
  return SHUTTLE_PARKING_TUTORIAL_SOLUTION.reduce((state, carId) => {
    const exit = exitShuttleParkingCar(
      shuttleParkingTutorialProblem,
      state,
      carId,
    );
    if (exit.outcome !== "exited") {
      throw new Error(`Tutorial car ${carId} must exit`);
    }
    return exit.state;
  }, createShuttleParkingInitialState(shuttleParkingTutorialProblem));
}

/** 詰んだときに「待った」で戻せるか。印の車を出した分は戻させない。 */
export function canUndoShuttleParkingTutorial(
  board: ShuttleParkingTutorialBoardState,
): boolean {
  return board.history.length > GUIDED_EXIT_COUNT;
}

function perform(
  situation: ShuttleParkingTutorialSituation,
  board: ShuttleParkingTutorialBoardState,
  action: ShuttleParkingTutorialAction,
): {
  state: ShuttleParkingTutorialBoardState;
  outcome: TutorialMoveOutcome;
} {
  const id = (board.lastMove?.id ?? 0) + 1;
  if (action.type === "undo") {
    if (!canUndoShuttleParkingTutorial(board)) {
      return { state: board, outcome: "ignored" };
    }
    return {
      state: {
        state: board.history.at(-1)!,
        history: board.history.slice(0, -1),
        lastMove: { type: "undone", id },
      },
      outcome: "continued",
    };
  }

  const { carId } = action;
  const exit = exitShuttleParkingCar(
    shuttleParkingTutorialProblem,
    board.state,
    carId,
  );
  if (exit.outcome === "not-parked") {
    return { state: board, outcome: "ignored" };
  }
  if (exit.outcome === "blocked") {
    const { outcome: _, ...block } = exit;
    return {
      state: { ...board, lastMove: { type: "blocked", id, carId, ...block } },
      outcome: "violated",
    };
  }

  const { step } = situation;
  const stepCarId = step?.carId ?? null;
  if (stepCarId !== null && stepCarId !== carId) {
    return {
      state: { ...board, lastMove: { type: "off-step", id, carId } },
      outcome: "violated",
    };
  }

  const stuck = isShuttleParkingStuck(
    shuttleParkingTutorialProblem,
    exit.state,
  );
  const state: ShuttleParkingTutorialBoardState = {
    state: exit.state,
    history: [...board.history, board.state],
    lastMove: {
      type: "exited",
      id,
      carId,
      side: exit.side,
      before: board.state,
      events: exit.events,
      stuck,
    },
  };
  if (isShuttleParkingCleared(shuttleParkingTutorialProblem, exit.state)) {
    return { state, outcome: "solved" };
  }
  if (stuck) {
    return { state, outcome: "violated" };
  }
  if (step && (stepCarId !== null || clearability.canClear(exit.state))) {
    return { state, outcome: "stepped" };
  }
  return { state, outcome: "continued" };
}

const freePlay: TutorialMessage = {
  headline: "先頭の乗客に合わせて残りの車も出し\n全員を送り出します",
  detail: null,
};

function describeViolation(
  situation: ShuttleParkingTutorialSituation,
  board: ShuttleParkingTutorialBoardState,
): TutorialMessage {
  const move = board.lastMove;
  switch (move?.type) {
    case "blocked":
      return move.reason === "bays-full"
        ? {
            headline: "待機枠が埋まっているので\n次の車を出せません",
            detail: null,
          }
        : {
            headline: "前に車があるので\nこの車はまだ出られません",
            detail: null,
          };
    case "exited":
      return {
        headline: "先頭の乗客が乗れる車がなく\n出せる車もなくなりました",
        detail: `「${PLAY_OPERATION_LABELS.undo}」で戻して出し直します`,
      };
    case "off-step":
      return { headline: "指さしている車をタップします", detail: null };
    default:
      return situation.step?.message ?? freePlay;
  }
}

export const shuttleParkingTutorial = {
  intro: {
    purpose: "駐車場の車を出して\n列の乗客を同じ色の車で送り出すパズルです",
    goalCaption: "全員を送り出せばクリアです",
  },
  rules: [
    { id: "board", label: "乗客は列の先頭から順に同じ色の車に乗る" },
    { id: "path", label: "前に車があると出られない" },
    { id: "bays", label: "待機枠が埋まると次の車を出せない" },
    { id: "sameColor", label: "同じ色が2台なら先に入った車から乗る" },
  ],
  steps,
  freePlay,
  completion: {
    home: {
      headline: "全員を送り出しました",
      detail: `${SHUTTLE_PARKING_DISPLAY_NAME}のレベル1を遊んでみましょう`,
    },
    play: {
      headline: "全員を送り出しました",
      detail: "プレイに戻って続けましょう",
    },
  },
  start: () => ({
    state: createShuttleParkingInitialState(shuttleParkingTutorialProblem),
    history: [],
    lastMove: null,
  }),
  goal: () => ({ state: createGoalState(), history: [], lastMove: null }),
  perform,
  describeViolation,
} as const satisfies Tutorial<
  ShuttleParkingTutorialRuleId,
  ShuttleParkingTutorialStep,
  ShuttleParkingTutorialBoardState,
  ShuttleParkingTutorialAction
>;

/** 手を引く間に印を付ける車。手を離した後と読みの手順は `null`。 */
export function getShuttleParkingTutorialStepCarId(
  situation: ShuttleParkingTutorialSituation,
): ShuttleParkingCarId | null {
  return situation.step?.carId ?? null;
}

/** 「ヒント」で示す車。出しても全員を送り出せる車。 */
export function findShuttleParkingTutorialHintCarId(
  board: ShuttleParkingTutorialBoardState,
): ShuttleParkingCarId | null {
  return (
    board.state.parkedCarIds.find((carId) => {
      const exit = exitShuttleParkingCar(
        shuttleParkingTutorialProblem,
        board.state,
        carId,
      );
      return exit.outcome === "exited" && clearability.canClear(exit.state);
    }) ?? null
  );
}

/** 進み具合の段は、出す車の数。 */
export const SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT =
  shuttleParkingTutorialProblem.lot.cars.length;

export function getShuttleParkingTutorialProgressRatio({
  state,
}: ShuttleParkingTutorialBoardState): number {
  return (
    (SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT - state.parkedCarIds.length) /
    SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT
  );
}
