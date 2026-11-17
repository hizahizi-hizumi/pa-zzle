import {
  listWaterSortPourRejections,
  listWaterSortSourceRejections,
  selectWaterSortBottle,
  type WaterSortBottleSelection,
  type WaterSortRejection,
} from "@/games/water-sort/puzzle/bottle-selection";
import {
  applyWaterSortMove,
  countWaterSortTopColorUnits,
  getWaterSortPourAmount,
} from "@/games/water-sort/puzzle/rules";
import type {
  WaterSortMove,
  WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  exampleMove,
  type WaterSortHowToPlayExample,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";

/** 例で最後に注いだ手。`amount` は移った量、`topColorUnits` は注ぐ前に注ぐボトルのいちばん上から続いていた同じ色の数。 */
type WaterSortExamplePour = {
  move: WaterSortMove;
  amount: number;
  topColorUnits: number;
};

/**
 * 例で最後に押して弾かれたボトル。`rejections` は本番の判定で弾いたわけで、注ぐボトルを選んでいなければ選べないわけ、
 * 選んでいれば、選んでいるボトルからそのボトルへ注げないわけ。
 */
type WaterSortExampleRejection = {
  bottleIndex: number;
  rejections: readonly WaterSortRejection[];
};

/**
 * 触れる例の今の姿。
 * - `sourceBottleIndex`: 注ぐボトルに選んでいるボトル。
 * - `lastPour`: 最後に注いだ手。まだ注いでいなければ `null`。
 * - `rejection`: 最後に押して弾かれたボトル。選び直す・選ぶのをやめる・注ぐ・元に戻すまで残す。
 */
export type WaterSortExampleBoard = {
  bottles: WaterSortState;
  sourceBottleIndex: number | null;
  lastPour: WaterSortExamplePour | null;
  rejection: WaterSortExampleRejection | null;
};

/** 例の判定。`rejections` は、選べないときの本番の判定でのわけ。 */
type WaterSortExampleVerdict = {
  allowed: boolean;
  rejections: readonly WaterSortRejection[];
};

export function createWaterSortExampleBoard(
  example: WaterSortHowToPlayExample,
): WaterSortExampleBoard {
  return {
    bottles: example.bottles,
    sourceBottleIndex: example.selectedBottleIndex ?? null,
    lastPour: null,
    rejection: null,
  };
}

/**
 * ボトルを押す。本番の盤面と同じく、注ぐボトルを選び、選ぶのをやめ、注ぎ先へ注ぎ、受け付けない押し方は盤面を変えない。
 * 盤面が受け付けたことも返し、本番と同じ動きと音に使う。
 * 弾かれたときは、押したボトルと、本番の判定で弾いたわけを残す。選び直すか注いだら、試し直したので消す。
 */
export function tapWaterSortExampleBottle(
  board: WaterSortExampleBoard,
  bottleIndex: number,
): { board: WaterSortExampleBoard; selection: WaterSortBottleSelection } {
  const { bottles, sourceBottleIndex } = board;
  const selection = selectWaterSortBottle(
    bottles,
    sourceBottleIndex,
    bottleIndex,
  );
  switch (selection.type) {
    case "source-selected":
    case "source-deselected":
      return {
        board: {
          ...board,
          sourceBottleIndex:
            selection.type === "source-selected" ? bottleIndex : null,
          rejection: null,
        },
        selection,
      };
    case "invalid":
      return {
        board: {
          ...board,
          rejection: {
            bottleIndex,
            rejections:
              sourceBottleIndex === null
                ? listWaterSortSourceRejections(bottles, bottleIndex)
                : listWaterSortPourRejections(bottles, {
                    sourceBottleIndex,
                    destinationBottleIndex: bottleIndex,
                  }),
          },
        },
        selection,
      };
    case "pour":
      return {
        board: {
          bottles: applyWaterSortMove(bottles, selection.move) ?? bottles,
          sourceBottleIndex: null,
          lastPour: {
            move: selection.move,
            amount: getWaterSortPourAmount(bottles, selection.move),
            topColorUnits: countWaterSortTopColorUnits(
              bottles[selection.move.sourceBottleIndex] ?? [],
            ),
          },
          rejection: null,
        },
        selection,
      };
  }
}

/**
 * 今の盤面で、選んでいるボトルから各ボトルへ注げるか。本番の盤面でそのボトルを押したときに注ぐかで決め、選んでいるボトル自身は `null`。
 * 注ぐボトルを選んでいなければ、答えは無いので `null` を返す。
 */
export function judgeWaterSortExampleDestinations({
  bottles,
  sourceBottleIndex,
}: WaterSortExampleBoard): (boolean | null)[] | null {
  if (sourceBottleIndex === null) {
    return null;
  }
  return bottles.map((_, bottleIndex) =>
    bottleIndex === sourceBottleIndex
      ? null
      : selectWaterSortBottle(bottles, sourceBottleIndex, bottleIndex).type ===
        "pour",
  );
}

/**
 * 今の盤面で、選んでいるボトルから各ボトルへ注げないわけ。本番の判定で求め、注げるボトルは空、選んでいるボトル自身は `null`。
 * 注ぐボトルを選んでいなければ、答えは無いので `null` を返す。
 */
export function listWaterSortExampleDestinationRejections({
  bottles,
  sourceBottleIndex,
}: WaterSortExampleBoard): (readonly WaterSortRejection[] | null)[] | null {
  if (sourceBottleIndex === null) {
    return null;
  }
  return bottles.map((_, bottleIndex) =>
    bottleIndex === sourceBottleIndex
      ? null
      : listWaterSortPourRejections(bottles, {
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
        }),
  );
}

/**
 * 例の、注ぐボトルに選べるかの判定。選んでいれば ✓、選ばずに押して弾かれたら ✕、その後に注いでいれば ✓ にする。
 * まだ試していない間は、例の左のボトルを判定する。
 */
export function judgeWaterSortExampleSelection(
  board: WaterSortExampleBoard,
): WaterSortExampleVerdict {
  if (board.sourceBottleIndex !== null) {
    return { allowed: true, rejections: [] };
  }
  if (board.rejection !== null) {
    return { allowed: false, rejections: board.rejection.rejections };
  }
  if (board.lastPour !== null) {
    return { allowed: true, rejections: [] };
  }
  const rejections = listWaterSortSourceRejections(
    board.bottles,
    exampleMove.sourceBottleIndex,
  );
  return { allowed: rejections.length === 0, rejections };
}

/**
 * 押す所の手がかりを付けるボトル。最初の形では注ぐボトル、注ぐボトルを選んだら注ぎ先に付ける。
 * どのボトルで弾かれても、選び直すか元に戻すまで付けない。弾かれた後も手がかりが残ると、弾かれたボトルと別の所を指したまま、
 * 押せば通るように読めるため。形が変わった後も付けない。
 */
export function getWaterSortExampleHintBottleIndex(
  board: WaterSortExampleBoard,
  example: WaterSortHowToPlayExample,
): number | null {
  if (
    board.rejection !== null ||
    !isSameWaterSortState(board.bottles, example.bottles)
  ) {
    return null;
  }
  if (board.sourceBottleIndex === null) {
    return exampleMove.sourceBottleIndex;
  }
  return board.sourceBottleIndex === exampleMove.sourceBottleIndex
    ? exampleMove.destinationBottleIndex
    : null;
}

export function isSameWaterSortState(
  left: WaterSortState,
  right: WaterSortState,
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (bottle, bottleIndex) =>
        bottle.length === right[bottleIndex]?.length &&
        bottle.every((color, layer) => color === right[bottleIndex]?.[layer]),
    )
  );
}
