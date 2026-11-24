import { selectSolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import { applySolitaireMove } from "@/games/solitaire/puzzle/rules";
import {
  isSameSolitaireState,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  applySolitaireSessionMove,
  type SolitaireSession,
  undoSolitaireSession,
} from "@/games/solitaire/session/session";
import {
  emptyColumnExamples,
  foundationOrderExamples,
  foundationPressExample,
  foundationReturnExamples,
  goalFigure,
  moveOperationExample,
  retractionFlows,
  runAmountExamples,
  type SolitaireHowToPlayExample,
  type SolitaireHowToPlayFrame,
  type SolitaireRetractionFlow,
  stackDestinationExample,
  stockDrawExample,
  stockRecycleExample,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import {
  canPlayExampleTrial,
  countExampleTrialCards,
  createSolitaireExampleBoard,
  pressSolitaireExamplePile,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/example-board";

/** 例が見せる手を、本番の押し方で最初から押していったときの、押すごとの受け付け方。 */
function listPressResults(example: SolitaireHowToPlayExample): string[] {
  let board = createSolitaireExampleBoard(example);
  return example.presses.map((pile) => {
    const { board: next, selection } = pressSolitaireExamplePile(board, pile);
    board = next;
    return selection.type;
  });
}

/** 例が見せる手を打てるかを、本番の判定で求める。 */
function judgeTrial(example: SolitaireHowToPlayExample): boolean {
  return canPlayExampleTrial(createSolitaireExampleBoard(example), example);
}

/** 流れの図の盤面から始めたセッション。本番のセッションの数え方で、取り消した手を数える。 */
function createSessionAt(state: SolitaireState): SolitaireSession {
  return {
    status: "playing",
    problem: {
      columns: [],
      stock: [],
    } as unknown as SolitaireSession["problem"],
    puzzleState: state,
    history: [],
    startedAt: 0,
    clearedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
    retractedMoveCount: 0,
  };
}

/** 流れの1つの矢印の操作を、本番のセッションで行う。動かす手は、コマで選んでいる置き元から列へ置く。 */
function playFlowStep(
  session: SolitaireSession,
  step: SolitaireRetractionFlow["steps"][number],
  frame: SolitaireHowToPlayFrame,
): SolitaireSession {
  if (step === "undo") {
    return undoSolitaireSession(session);
  }
  const selection =
    step === "draw"
      ? selectSolitairePile(session.puzzleState, null, { pile: "stock" })
      : selectSolitairePile(session.puzzleState, frame.selectedSource ?? null, {
          pile: "column",
          columnIndex: 0,
        });
  return selection.type === "move"
    ? applySolitaireSessionMove(session, selection.move, 0)
    : session;
}

/** 流れを始まりのコマから本番のセッションで進め、各矢印の後に次のコマの盤面になったかと、数えた取り消した手を返す。 */
function playRetractionFlow(flow: SolitaireRetractionFlow) {
  let session = createSessionAt(flow.frames[0]!.state);
  const reachedFrames = flow.steps.map((step, index) => {
    session = playFlowStep(session, step, flow.frames[index]!);
    return isSameSolitaireState(
      session.puzzleState,
      flow.frames[index + 1]!.state,
    );
  });
  return { reachedFrames, retractedMoveCount: session.retractedMoveCount };
}

/** 始まりの盤面から、ゴールの盤面の手を本番の遷移で順に打った盤面。打てない手があれば `null`。 */
function playGoalMoves(): (SolitaireState | null)[] {
  const states: (SolitaireState | null)[] = [goalFigure.start];
  for (const move of goalFigure.moves) {
    const previous = states.at(-1);
    states.push(previous ? applySolitaireMove(previous, move) : null);
  }
  return states;
}

describe("ルールの例の場合", () => {
  const stackDestinations = [1, 2, 3].map(
    (columnIndex) => ({ pile: "column", columnIndex }) as const,
  );
  const verdictPairs = [
    ["空いた列", emptyColumnExamples],
    ["組札の順", foundationOrderExamples],
    ["組札から列へ戻す", foundationReturnExamples],
  ] as const;
  const pressPaths = [
    ["列に重ねる", stackDestinationExample, ["move"]],
    [
      "山札をめくって使う",
      stockDrawExample,
      ["move", "source-selected", "move"],
    ],
    ["捨て札を山札へ戻す", stockRecycleExample, ["move"]],
    ["動かし方", moveOperationExample, ["source-selected", "move"]],
    ["組札の押し方", foundationPressExample, ["source-selected", "move"]],
  ] as const;

  test("列に重ねる例の置き元からは、♠8 の列にだけ置けること", () => {
    const results = stackDestinations.map(
      (pile) =>
        selectSolitairePile(
          stackDestinationExample.state,
          stackDestinationExample.selectedSource,
          pile,
        ).type,
    );

    expect(results).toEqual(["move", "invalid", "invalid"]);
  });

  test("並びの例は、置く先によって動く枚数が3枚と2枚になること", () => {
    const counts = runAmountExamples.map((example) =>
      countExampleTrialCards(createSolitaireExampleBoard(example), example),
    );

    expect(counts).toEqual([3, 2]);
  });

  test.each(verdictPairs)(
    "%sの対は、左の手を打てて右の手を打てないこと",
    (_, examples) => {
      const verdicts = examples.map(judgeTrial);

      expect(verdicts).toEqual([true, false]);
    },
  );

  test.each(pressPaths)(
    "%sの例は、手がかりの順に押すと手を打ち終えること",
    (_, example, expected) => {
      const results = listPressResults(example);

      expect(results).toEqual(expected);
    },
  );

  test("組札の押し方の例は、♠ の組札を押しても ♥ の組札へ置かれること", () => {
    const board = foundationPressExample.presses.reduce(
      (current, pile) => pressSolitaireExamplePile(current, pile).board,
      createSolitaireExampleBoard(foundationPressExample),
    );

    expect(board.state.foundations).toEqual({
      spades: 0,
      hearts: 3,
      diamonds: 0,
      clubs: 0,
    });
  });
});

describe("ゴールの盤面の場合", () => {
  test("始まりの盤面から本番の手で運び切ると、最後の手でクリアの盤面になること", () => {
    const states = playGoalMoves();

    expect(states.every((state) => state !== null)).toBe(true);
    expect(isSolitaireCleared(states.at(-1)!)).toBe(true);
    expect(isSolitaireCleared(states.at(-2)!)).toBe(false);
  });
});

describe("取り消した手の流れの場合", () => {
  const flows = retractionFlows.map(
    (flow, index) => [index + 1, flow] as const,
  );

  test.each(flows)(
    "流れ%iのコマが本番の手と待ったでつながり、本番の数え方で数えた取り消した手を添えること",
    (_, flow) => {
      const { reachedFrames, retractedMoveCount } = playRetractionFlow(flow);

      expect(reachedFrames).toEqual(flow.steps.map(() => true));
      expect(retractedMoveCount).toBe(flow.retractedMoveCount);
    },
  );

  test("どの流れも同じ始まりの盤面から始まること", () => {
    const starts = retractionFlows.map(({ frames }) => frames[0]!.state);

    const sameStarts = starts.map((state) =>
      isSameSolitaireState(state, starts[0]!),
    );

    expect(sameStarts).toEqual(starts.map(() => true));
  });
});
