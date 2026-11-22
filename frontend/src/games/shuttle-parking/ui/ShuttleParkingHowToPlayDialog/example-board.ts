import { createShuttleParkingExitTimeline } from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

/**
 * 遊び方の触れる例1つ。`setup` の順に出した盤面から始め、`hintCarId` の車に押す所の手がかりを付ける。
 */
export type ShuttleParkingHowToPlayExample = {
  puzzle: ShuttleParkingPuzzle;
  setup: readonly ShuttleParkingCarId[];
  hintCarId: ShuttleParkingCarId;
};

/**
 * 触れる例の今の姿。`lastTap` は直前に押した車の結果で、判定の言葉と本番の盤面の動きに使う。
 */
export type ShuttleParkingExampleBoard = {
  puzzle: ShuttleParkingPuzzle;
  state: ShuttleParkingState;
  initial: ShuttleParkingState;
  operation: ShuttleParkingOperation | null;
};

function exitInOrder(
  puzzle: ShuttleParkingPuzzle,
  carIds: readonly ShuttleParkingCarId[],
): ShuttleParkingState {
  return carIds.reduce((state, carId) => {
    const exit = exitShuttleParkingCar(puzzle, state, carId);
    if (exit.outcome !== "exited") {
      throw new Error(`Example car ${carId} must exit`);
    }
    return exit.state;
  }, createShuttleParkingInitialState(puzzle));
}

export function createShuttleParkingExampleBoard({
  puzzle,
  setup,
}: ShuttleParkingHowToPlayExample): ShuttleParkingExampleBoard {
  const state = exitInOrder(puzzle, setup);
  return { puzzle, state, initial: state, operation: null };
}

/** 本番と同じく、車を出すか、出せないときは盤面を変えずに揺らす知らせだけを返す。 */
export function tapShuttleParkingExampleCar(
  board: ShuttleParkingExampleBoard,
  carId: ShuttleParkingCarId,
  operationId: number,
  tappedAt: number,
): ShuttleParkingExampleBoard {
  const exit = exitShuttleParkingCar(board.puzzle, board.state, carId);
  switch (exit.outcome) {
    case "not-parked":
      return board;
    case "blocked": {
      const { outcome: _, ...block } = exit;
      return {
        ...board,
        operation: { id: operationId, type: "blocked", carId, ...block },
      };
    }
    case "exited":
      return {
        ...board,
        state: exit.state,
        operation: {
          id: operationId,
          type: "exited",
          carId,
          side: exit.side,
          timeline: createShuttleParkingExitTimeline(
            board.state,
            carId,
            exit.events,
          ),
          startedAt: tappedAt,
        },
      };
  }
}

export function isShuttleParkingExampleChanged(
  board: ShuttleParkingExampleBoard,
): boolean {
  return board.state !== board.initial;
}

/**
 * 判定。押す前は手がかりの車を出せるか、押した後は試した車を出せたか。
 * `boardedCount` は押した後に乗った人数で、乗る例の言葉に使う。
 */
export type ShuttleParkingExampleVerdict = {
  exitable: boolean;
  tried: boolean;
  reason: "path-blocked" | "bays-full" | null;
  boardedCount: number;
  departedCount: number;
};

export function judgeShuttleParkingExample(
  board: ShuttleParkingExampleBoard,
  hintCarId: ShuttleParkingCarId,
): ShuttleParkingExampleVerdict {
  const { operation } = board;
  if (operation?.type === "exited") {
    const events = operation.timeline.frames;
    const boarded = board.state.boardedCount - (events[0]?.boardedCount ?? 0);
    const departed = events.filter(
      (frame) => frame.departingCarId !== null,
    ).length;
    return {
      exitable: true,
      tried: true,
      reason: null,
      boardedCount: boarded,
      departedCount: departed,
    };
  }
  if (operation?.type === "blocked") {
    return {
      exitable: false,
      tried: true,
      reason: operation.reason,
      boardedCount: 0,
      departedCount: 0,
    };
  }
  const exit = exitShuttleParkingCar(board.puzzle, board.state, hintCarId);
  return {
    exitable: exit.outcome === "exited",
    tried: false,
    reason: exit.outcome === "blocked" ? exit.reason : null,
    boardedCount: 0,
    departedCount: 0,
  };
}

const lotCars = {
  redFront: {
    row: 0,
    column: 0,
    orientation: "vertical",
    capacity: 2,
    color: "a",
  },
  blueBehind: {
    row: 2,
    column: 0,
    orientation: "vertical",
    capacity: 2,
    color: "b",
  },
} as const;

/** 前が空いた車と、前を塞がれた車。上だけが開いた駐車場。 */
export const exitRuleExamples = [
  {
    puzzle: {
      lot: {
        size: 4,
        openSides: ["top"],
        cars: [lotCars.redFront, lotCars.blueBehind],
      },
      passengers: ["a", "a", "b", "b"],
      bayCount: 2,
    },
    setup: [],
    hintCarId: 0,
  },
  {
    puzzle: {
      lot: {
        size: 4,
        openSides: ["top"],
        cars: [lotCars.redFront, lotCars.blueBehind],
      },
      passengers: ["a", "a", "b", "b"],
      bayCount: 2,
    },
    setup: [],
    hintCarId: 1,
  },
] as const satisfies readonly ShuttleParkingHowToPlayExample[];

/**
 * 待機枠で待つ青の車に、赤の車を出す。先頭の赤2人が赤の車に乗って出発し、続く青2人が待っていた青の車に乗って出発する。
 * 上と右が開いた駐車場で、横の車は右へ出る。
 */
export const boardRuleExample = {
  puzzle: {
    lot: {
      size: 4,
      openSides: ["top", "right"],
      cars: [
        {
          row: 1,
          column: 0,
          orientation: "horizontal",
          capacity: 2,
          color: "a",
        },
        {
          row: 0,
          column: 3,
          orientation: "vertical",
          capacity: 2,
          color: "b",
        },
        {
          row: 3,
          column: 1,
          orientation: "horizontal",
          capacity: 3,
          color: "c",
        },
      ],
    },
    passengers: ["a", "a", "b", "b", "c", "c", "c"],
    bayCount: 2,
  },
  setup: [1],
  hintCarId: 0,
} as const satisfies ShuttleParkingHowToPlayExample;

/** 待機枠1つが黄の車で埋まっていて、前の空いた赤の車も出せない。 */
export const baysRuleExample = {
  puzzle: {
    lot: {
      size: 4,
      openSides: ["top"],
      cars: [
        { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
        { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "c" },
      ],
    },
    passengers: ["a", "a", "c", "c"],
    bayCount: 1,
  },
  setup: [1],
  hintCarId: 0,
} as const satisfies ShuttleParkingHowToPlayExample;

/** 操作の例。押すと出て、先頭の乗客が乗る。 */
export const exitOperationExample = {
  puzzle: {
    lot: {
      size: 4,
      openSides: ["top"],
      cars: [
        { row: 1, column: 1, orientation: "vertical", capacity: 2, color: "a" },
        { row: 0, column: 3, orientation: "vertical", capacity: 3, color: "b" },
      ],
    },
    passengers: ["a", "b", "a", "b", "b"],
    bayCount: 2,
  },
  setup: [],
  hintCarId: 0,
} as const satisfies ShuttleParkingHowToPlayExample;
