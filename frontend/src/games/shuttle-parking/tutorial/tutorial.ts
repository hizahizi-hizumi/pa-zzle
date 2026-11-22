import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import type {
  ShuttleParkingCarId,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
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
 * - `bays`: 待機枠が埋まると次の車を出せないので、先頭の乗客が乗れる車を出す。
 */
export type ShuttleParkingTutorialRuleId = "board" | "bays";

export type ShuttleParkingTutorialAction = { carId: ShuttleParkingCarId };

/** `carId` は印を付けて押させる車。読みの手順では `null` で、どの車を出すかを自分で選ばせる。 */
export type ShuttleParkingTutorialStep =
  TutorialStep<ShuttleParkingTutorialRuleId> & {
    carId: ShuttleParkingCarId | null;
  };

/**
 * 直前の手。盤面の動きと一言に使う。
 * - `exited`: 車を出した。`before` は出す前の盤面。
 * - `blocked`: 出せない車を押した。盤面は変わらない。
 * - `off-step`: 手順と違う車を押した。盤面は変わらない。
 * - `stranding`: 読みの手順で、出すと先頭の乗客が乗れず待機枠が埋まる車を押した。盤面は変わらない。
 */
export type ShuttleParkingTutorialMove =
  | {
      type: "exited";
      id: number;
      carId: ShuttleParkingCarId;
      side: ShuttleParkingSide;
      before: ShuttleParkingState;
      events: readonly ShuttleParkingBoardingEvent[];
    }
  | ({
      type: "blocked";
      id: number;
      carId: ShuttleParkingCarId;
    } & ShuttleParkingExitBlock)
  | {
      type: "off-step" | "stranding";
      id: number;
      carId: ShuttleParkingCarId;
    };

export type ShuttleParkingTutorialBoardState = {
  state: ShuttleParkingState;
  lastMove: ShuttleParkingTutorialMove | null;
};

export type ShuttleParkingTutorialSituation = TutorialSituation<
  ShuttleParkingTutorialRuleId,
  ShuttleParkingTutorialStep
>;

/**
 * 4×4 で上だけが開いた駐車場に4台。待機枠は2つ。
 *
 * ```text
 *  vvvv      車0 赤3人  車1 黄2人（車3の後ろ）
 * 02.3      車2 青2人  車3 赤2人
 * 02.3      列: 赤 赤 黄 赤 黄 赤 青 赤 青
 * 0..1
 * ...1
 * ```
 *
 * 車3を出すと先頭の赤2人が乗って出発し、塞がれていた車1が出られる。車1を出すと黄が1人乗り、車1は待つ。
 * 次の先頭は赤なので、ここで車0（赤）を出すと続けられ、車2（青）を出すと待機枠が埋まって詰む。
 * 車0を出した後は、どの順で出しても全員を送り出せる。
 */
export const shuttleParkingTutorialProblem: ShuttleParkingProblem = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 3, color: "a" },
      { row: 2, column: 3, orientation: "vertical", capacity: 2, color: "c" },
      { row: 0, column: 1, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 3, orientation: "vertical", capacity: 2, color: "a" },
    ],
  },
  passengers: ["a", "a", "c", "a", "c", "a", "b", "a", "b"],
  bayCount: 2,
};

const steps: readonly ShuttleParkingTutorialStep[] = [
  {
    message: {
      headline: "車をタップすると\n向いている方へ進んで待機枠に入ります",
      detail: null,
    },
    introducedRuleId: null,
    carId: 3,
  },
  {
    message: {
      headline: "乗客は列の先頭から順に\n同じ色の車に1人ずつ乗ります",
      detail: "席が埋まった車は出発して枠が空きます",
    },
    introducedRuleId: "board",
    carId: 1,
  },
  {
    message: {
      headline: "待機枠が埋まると\n次の車を出せません",
      detail: "先頭の乗客が乗れる車を選んで出します",
    },
    introducedRuleId: "bays",
    carId: null,
  },
];

const clearability = createShuttleParkingClearability(
  shuttleParkingTutorialProblem,
);

function createGoalState(): ShuttleParkingState {
  return [3, 1, 0, 2].reduce((state, carId) => {
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

function perform(
  situation: ShuttleParkingTutorialSituation,
  board: ShuttleParkingTutorialBoardState,
  { carId }: ShuttleParkingTutorialAction,
): {
  state: ShuttleParkingTutorialBoardState;
  outcome: TutorialMoveOutcome;
} {
  const id = (board.lastMove?.id ?? 0) + 1;
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
  if (
    step?.carId !== null &&
    step?.carId !== undefined &&
    step.carId !== carId
  ) {
    return {
      state: { ...board, lastMove: { type: "off-step", id, carId } },
      outcome: "violated",
    };
  }
  if (step?.carId === null && !clearability.canClear(exit.state)) {
    return {
      state: { ...board, lastMove: { type: "stranding", id, carId } },
      outcome: "violated",
    };
  }

  const state: ShuttleParkingTutorialBoardState = {
    state: exit.state,
    lastMove: {
      type: "exited",
      id,
      carId,
      side: exit.side,
      before: board.state,
      events: exit.events,
    },
  };
  if (isShuttleParkingCleared(shuttleParkingTutorialProblem, exit.state)) {
    return { state, outcome: "solved" };
  }
  return { state, outcome: step ? "stepped" : "continued" };
}

function describeViolation(
  situation: ShuttleParkingTutorialSituation,
  board: ShuttleParkingTutorialBoardState,
): TutorialMessage {
  const move = board.lastMove;
  if (move?.type === "blocked" && move.reason === "bays-full") {
    return {
      headline: "待機枠が埋まっているので\n次の車を出せません",
      detail: null,
    };
  }
  if (move?.type === "blocked") {
    return {
      headline: "前に車があるので\nこの車はまだ出られません",
      detail: null,
    };
  }
  if (move?.type === "stranding") {
    return {
      headline:
        "その車には先頭の乗客が乗れず\n待機枠が埋まって次を出せなくなります",
      detail: "先頭の乗客が乗れる車を出します",
    };
  }
  return situation.step?.message ?? freePlay;
}

const freePlay: TutorialMessage = {
  headline: "残りの車も出して\n全員を送り出します",
  detail: null,
};

export const shuttleParkingTutorial = {
  intro: {
    purpose: `駐車場の車を出して\n列の乗客を同じ色の車で送り出すパズルです`,
    goalCaption: "全員を送り出せばクリアです",
  },
  rules: [
    { id: "board", label: "乗客は列の先頭から順に同じ色の車に乗る" },
    { id: "bays", label: "待機枠が埋まると次の車を出せない" },
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
    lastMove: null,
  }),
  goal: () => ({ state: createGoalState(), lastMove: null }),
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

/** 手を離した後に「ヒント」で示す車。先頭の乗客が乗れて、全員を送り出せる車。 */
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

/** 出た車は戻らないので、後戻りしない。 */
export function getShuttleParkingTutorialProgressRatio({
  state,
}: ShuttleParkingTutorialBoardState): number {
  return (
    (SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT - state.parkedCarIds.length) /
    SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT
  );
}
