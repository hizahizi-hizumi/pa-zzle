import { assertHakoiriMusumeProblem } from "@/games/hakoiri-musume/problem/problem";
import {
  formatHakoiriMusumeBoard,
  getHakoiriMusumeCellPosition,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  isHakoiriMusumeCleared,
  moveHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import type { HakoiriMusumeState } from "@/games/hakoiri-musume/puzzle/state";
import {
  _private,
  describeHakoiriMusumeTutorialStep,
  findHakoiriMusumeTutorialHintPiece,
  getHakoiriMusumeTutorialPuzzle,
  type HakoiriMusumeTutorialAction,
  type HakoiriMusumeTutorialBoardState,
  type HakoiriMusumeTutorialRuleId,
  hakoiriMusumeTutorial,
} from "@/games/hakoiri-musume/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type Progress = TutorialProgress<
  HakoiriMusumeTutorialRuleId,
  HakoiriMusumeTutorialBoardState
>;

const { steps } = hakoiriMusumeTutorial;
const [slideStep, countStep, blockStep, clearStep] = steps;
const start = getHakoiriMusumeTutorialPuzzle(hakoiriMusumeTutorial.start());
const goal = getHakoiriMusumeTutorialPuzzle(hakoiriMusumeTutorial.goal());
const started = finishTutorialIntro(startTutorial(hakoiriMusumeTutorial));
const { listOneHandStates } = _private;

/** 始めの盤面の最短手数。 */
const OPTIMAL_MOVE_COUNT = 5;

const DAUGHTER = 0;
const GUIDED_SMALL = 1;
const HORIZONTAL = 2;
const TURNING_VERTICAL = 3;

const opposite = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
} as const satisfies Record<HakoiriMusumeDirection, HakoiriMusumeDirection>;

function move(
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
): HakoiriMusumeTutorialAction {
  return { type: "move", pieceIndex, direction };
}

function puzzleOf(progress: Progress): HakoiriMusumeState {
  return getHakoiriMusumeTutorialPuzzle(progress.boardState);
}

/** 操作を順に行った後の進行すべて。 */
function performAll(
  from: Progress,
  actions: readonly HakoiriMusumeTutorialAction[],
): Progress[] {
  const traced: Progress[] = [];
  let current = from;
  for (const action of actions) {
    current = performTutorialAction(hakoiriMusumeTutorial, current, action);
    traced.push(current);
  }
  return traced;
}

function performThrough(
  from: Progress,
  actions: readonly HakoiriMusumeTutorialAction[],
): Progress {
  return performAll(from, actions).at(-1) ?? from;
}

/** 手を引く手順を、手順の一言が示すとおりに進める操作。 */
const guidedActions = {
  slide: [move(GUIDED_SMALL, "up")],
  count: [move(GUIDED_SMALL, "up")],
  block: [{ type: "push", pieceIndex: HORIZONTAL, direction: "up" }],
  clear: [move(DAUGHTER, "right")],
} as const satisfies Record<string, readonly HakoiriMusumeTutorialAction[]>;

/** 手を離した後、横長を上げ、縦長を左上へ回し、娘を下ろす操作。 */
const remainingActions = [
  move(HORIZONTAL, "up"),
  move(HORIZONTAL, "up"),
  move(HORIZONTAL, "up"),
  move(TURNING_VERTICAL, "left"),
  move(TURNING_VERTICAL, "up"),
  move(TURNING_VERTICAL, "left"),
  move(TURNING_VERTICAL, "up"),
  move(DAUGHTER, "left"),
  move(DAUGHTER, "down"),
  move(DAUGHTER, "down"),
] as const;

const afterSlide = performThrough(started, guidedActions.slide);
const afterCount = performThrough(afterSlide, guidedActions.count);
const afterBlock = performThrough(afterCount, guidedActions.block);
const afterClear = performThrough(afterBlock, guidedActions.clear);

/** `found` に当たる盤面へ行く最も少ない手数（同じ駒の続けての移動を1手）。行けなければ `null`。 */
function searchByHands(
  from: HakoiriMusumeState,
  found: (state: HakoiriMusumeState) => boolean,
): number | null {
  const visited = new Set([formatHakoiriMusumeBoard(from.pieces)]);
  let layer = [from];
  for (let hands = 0; layer.length > 0; hands += 1) {
    if (layer.some(found)) {
      return hands;
    }
    const next: HakoiriMusumeState[] = [];
    for (const state of layer) {
      state.pieces.forEach((_, pieceIndex) => {
        for (const moved of listOneHandStates(state, pieceIndex)) {
          const key = formatHakoiriMusumeBoard(moved.pieces);
          if (!visited.has(key)) {
            visited.add(key);
            next.push(moved);
          }
        }
      });
    }
    layer = next;
  }
  return null;
}

function countFewestHands(from: HakoiriMusumeState): number | null {
  return searchByHands(from, isHakoiriMusumeCleared);
}

/** 手がかりの駒を、残りの手数が1つ減る所へ1手で動かし続けて、解き終えるまでの手数。 */
function countHandsFollowingHints(from: HakoiriMusumeState): number {
  let state = from;
  let hands = 0;
  while (!isHakoiriMusumeCleared(state) && hands < 20) {
    const pieceIndex = findHakoiriMusumeTutorialHintPiece({
      ...hakoiriMusumeTutorial.start(),
      puzzle: state,
    });
    const remaining = countFewestHands(state);
    const next = listOneHandStates(state, pieceIndex ?? 0).find(
      (moved) => countFewestHands(moved) === (remaining ?? 0) - 1,
    );
    if (!next) {
      return Number.POSITIVE_INFINITY;
    }
    state = next;
    hands += 1;
  }
  return hands;
}

/** 駒を1マス動かせる手と、動かした後の盤面すべて。 */
function listStepMoves(state: HakoiriMusumeState) {
  return state.pieces.flatMap((_, pieceIndex) =>
    hakoiriMusumeDirections.flatMap((direction) => {
      const moved = moveHakoiriMusumePiece(state, pieceIndex, direction);
      return moved ? [{ pieceIndex, direction, moved }] : [];
    }),
  );
}

/**
 * 盤面から駒を1マスずつ動かしてたどり着く盤面を、近い順に `limit` 個まで幅優先でたどり、逆向きの1マスで元へ戻せない手を集める。
 * 同じ種類の駒どうしが入れ替わっただけの盤面は同じとみなす。
 */
function listIrreversibleSteps(
  from: HakoiriMusumeState,
  limit: number,
): string[] {
  const visited = new Set([formatHakoiriMusumeBoard(from.pieces)]);
  const queue = [from];
  const irreversible: string[] = [];
  for (let head = 0; head < queue.length && head < limit; head += 1) {
    const state = queue[head]!;
    const key = formatHakoiriMusumeBoard(state.pieces);
    for (const { pieceIndex, direction, moved } of listStepMoves(state)) {
      const back = moveHakoiriMusumePiece(
        moved,
        pieceIndex,
        opposite[direction],
      );
      if (!back || formatHakoiriMusumeBoard(back.pieces) !== key) {
        irreversible.push(`${key} ${pieceIndex} ${direction}`);
      }
      const movedKey = formatHakoiriMusumeBoard(moved.pieces);
      if (!visited.has(movedKey)) {
        visited.add(movedKey);
        queue.push(moved);
      }
    }
  }
  return irreversible;
}

/** 印の駒が今の盤面で1マス動ける向き。 */
function listOpenDirections(
  state: HakoiriMusumeState,
  pieceIndex: number,
): HakoiriMusumeDirection[] {
  return hakoiriMusumeDirections.filter(
    (direction) =>
      moveHakoiriMusumePiece(state, pieceIndex, direction) !== null,
  );
}

function sortKinds(state: HakoiriMusumeState): string[] {
  return state.pieces.map(({ kind }) => kind).sort();
}

describe("盤面", () => {
  test("本番と同じ形の問題として受け付けられること", () => {
    const act = () => assertHakoiriMusumeProblem({ pieces: start.pieces });

    expect(act).not.toThrow();
  });

  test("ゴールの盤面が、始めの盤面と同じ駒で娘を出口の前に置いた盤面であること", () => {
    const kinds = sortKinds(goal);
    const cleared = isHakoiriMusumeCleared(goal);

    expect(kinds).toEqual(sortKinds(start));
    expect(cleared).toBe(true);
  });

  test("始めの盤面から、完成の一言に添える最短手数で解けること", () => {
    const hands = countFewestHands(start);

    expect(hands).toBe(OPTIMAL_MOVE_COUNT);
  });

  test("導入で見せるゴールの盤面に、始めの盤面から最短手数で届くこと", () => {
    const goalBoard = formatHakoiriMusumeBoard(goal.pieces);

    const hands = searchByHands(
      start,
      (state) => formatHakoiriMusumeBoard(state.pieces) === goalBoard,
    );

    expect(hands).toBe(OPTIMAL_MOVE_COUNT);
  });
});

describe("ルール", () => {
  test("ルールのそれぞれを、上部に並べる順に1つずつ示すこと", () => {
    const introduced = steps.flatMap(({ introducedRuleId }) =>
      introducedRuleId === null ? [] : [introducedRuleId],
    );

    expect(introduced).toEqual(hakoiriMusumeTutorial.rules.map(({ id }) => id));
  });

  test("空いたマスへ動かすルールで、手順1と2の印の駒の動かし方が1つに決まること", () => {
    const openDirections = [
      listOpenDirections(start, slideStep!.pieceIndex),
      listOpenDirections(puzzleOf(afterSlide), countStep!.pieceIndex).filter(
        (direction) => direction !== "down",
      ),
    ];

    expect(openDirections).toEqual([["up"], ["up"]]);
  });

  describe("手順3の盤面の場合", () => {
    const board = puzzleOf(afterCount);
    const horizontal = getHakoiriMusumeCellPosition(
      board.pieces[blockStep!.pieceIndex]!.cell,
    );
    const above = [0, 1].map(
      (offset) => (horizontal.row - 1) * 4 + horizontal.column + offset,
    );

    test("通り抜けられないルールで、印の横長のすぐ上を決め手の娘がふさいでいること", () => {
      const covering = board.pieces.flatMap((piece, pieceIndex) =>
        listHakoiriMusumePieceCells(piece).some((cell) => above.includes(cell))
          ? [pieceIndex]
          : [],
      );

      expect(covering).toEqual([...blockStep!.deciderPieceIndices]);
    });

    test("印の横長はどの向きへも動かせず、ふさがれた上と見分けのつかない空いた向きが無いこと", () => {
      const open = listOpenDirections(board, blockStep!.pieceIndex);

      expect(open).toEqual([]);
    });
  });
});

describe("手を引く手順", () => {
  test("手順どおりに進める間、どの手も次の手順へ進め、ルールに合わない手にならないこと", () => {
    const traced = performAll(started, [
      ...guidedActions.slide,
      ...guidedActions.count,
      ...guidedActions.block,
      ...guidedActions.clear,
    ]);

    expect(traced.map(({ stepIndex }) => stepIndex)).toEqual([1, 2, 3, 4]);
    expect(traced.some(({ violated }) => violated)).toBe(false);
  });

  test("印の駒を手順と違う向きへ動かした途中の盤面も、まだ教えていないルールに当たらないこと", () => {
    const traced = [
      ...performAll(afterSlide, [move(GUIDED_SMALL, "down")]),
      ...performAll(afterBlock, [move(DAUGHTER, "left")]),
    ];

    expect(traced.map(({ stepIndex }) => stepIndex)).toEqual([1, 3]);
    expect(traced.some(({ violated }) => violated)).toBe(false);
  });

  describe("空いたマスへ動かす手順", () => {
    const step = slideStep!;

    test("印の駒の行き先を覆いから抜いて見せ、そこへ着くと次の手順へ進むこと", () => {
      const reached = puzzleOf(afterSlide).pieces[step.pieceIndex]!.cell;

      expect(step.targetCells).toEqual([reached]);
      expect(afterSlide.stepIndex).toBe(1);
    });

    test("印の無い駒を動かそうとしても、盤面が変わらないこと", () => {
      const results = start.pieces.flatMap((_, pieceIndex) =>
        pieceIndex === step.pieceIndex
          ? []
          : hakoiriMusumeDirections.map((direction) =>
              performTutorialAction(
                hakoiriMusumeTutorial,
                started,
                move(pieceIndex, direction),
              ),
            ),
      );

      expect(results.every((result) => result === started)).toBe(true);
    });
  });

  describe("同じ駒を続けて動かす手順", () => {
    test("同じ駒を続けて動かすと、ゴールの盤面と同じ所へ収まること", () => {
      const cell = puzzleOf(afterCount).pieces[countStep!.pieceIndex]!.cell;
      const kindAtGoal = goal.pieces.find((piece) => piece.cell === cell)?.kind;

      expect(kindAtGoal).toBe("small");
    });

    test("印の小駒を下へ戻すと、手順を進めず、上へ動かすよう言い直すこと", () => {
      const progress = performThrough(afterSlide, [move(GUIDED_SMALL, "down")]);

      const message = describeHakoiriMusumeTutorialStep(
        getTutorialSituation(hakoiriMusumeTutorial, progress),
        progress.boardState,
      );

      expect(progress.stepIndex).toBe(1);
      expect(message).toEqual(countStep!.stray?.message);
    });
  });

  describe("通り抜けられないことを示す手順", () => {
    test("横長を上へ動かそうとすると、盤面を変えずに次の手順へ進むこと", () => {
      const { boardState, stepIndex } = afterBlock;

      expect(boardState).toBe(afterCount.boardState);
      expect(stepIndex).toBe(3);
    });

    test("キーボードで横長を上へ動かそうとしても、同じく次の手順へ進むこと", () => {
      const { stepIndex } = performThrough(afterCount, [
        move(HORIZONTAL, "up"),
      ]);

      expect(stepIndex).toBe(3);
    });
  });

  describe("娘をどかす手順", () => {
    const step = clearStep!;
    const board = puzzleOf(afterBlock);

    test("娘が1手で行ける所のうち、横長が上へ動かせるようになる所でだけ手を離すこと", () => {
      const liftable = listOneHandStates(board, step.pieceIndex)
        .filter(
          (state) => moveHakoiriMusumePiece(state, HORIZONTAL, "up") !== null,
        )
        .map((state) => state.pieces[step.pieceIndex]!.cell)
        .sort((a, b) => a - b);

      expect(step.goal).toEqual({ type: "reach", cells: liftable });
    });

    test("決め手の横長を示すこと", () => {
      const deciders = step.deciderPieceIndices;

      expect(deciders).toEqual([HORIZONTAL]);
    });

    test("横長の上が空かない左へ娘をどかすと、手順を進めず、そのわけを言うこと", () => {
      const progress = performThrough(afterBlock, [move(DAUGHTER, "left")]);

      const message = describeHakoiriMusumeTutorialStep(
        getTutorialSituation(hakoiriMusumeTutorial, progress),
        progress.boardState,
      );

      expect(progress.stepIndex).toBe(3);
      expect(message).toEqual(step.stray?.message);
    });
  });
});

describe("手を離した後", () => {
  const freeBoard = puzzleOf(afterClear);

  test("手順を終えると、手を引く手順が残っていないこと", () => {
    const { stepIndex } = afterClear;

    expect(stepIndex).toBe(steps.length);
  });

  test("娘をどかした直後に、また娘を手がかりに示さないこと", () => {
    const hint = findHakoiriMusumeTutorialHintPiece(afterClear.boardState);

    expect(hint).not.toBe(DAUGHTER);
  });

  test("手がかりをたどると、残りを最も少ない3手で解き終えること", () => {
    const hands = countHandsFollowingHints(freeBoard);

    expect(hands).toBe(3);
  });

  test("娘を出口の前へ運んだ手で解き終え、手数を入れずに完成を伝えること", () => {
    const traced = performAll(afterClear, remainingActions);

    const message = getTutorialMessage(hakoiriMusumeTutorial, traced.at(-1)!, {
      entry: "home",
      violationSettled: true,
    });

    expect(traced.map(({ phase }) => phase).indexOf("solved")).toBe(
      remainingActions.length - 1,
    );
    expect(message).toEqual(hakoiriMusumeTutorial.completion.home);
    expect(message.headline).not.toMatch(/手/);
  });

  /**
   * どの手も逆向きの1マスで戻せれば、たどり着いたどの盤面からも始めの盤面へ戻れるので、手詰まりにならない。
   * 手を離した後の盤面から近い順に 5,000 の盤面で確かめる。
   */
  test("手を離した後の盤面の近くのどの盤面でも、駒を1マス動かした手は逆向きの1マスで戻せること", () => {
    const irreversible = listIrreversibleSteps(freeBoard, 5_000);

    expect(irreversible).toEqual([]);
  });
});

describe("findFirstPieceOfFewestHands", () => {
  test("解き終えた盤面では、動かす駒が無いこと", () => {
    const pieceIndex = _private.findFirstPieceOfFewestHands(goal);

    expect(pieceIndex).toBeNull();
  });
});
