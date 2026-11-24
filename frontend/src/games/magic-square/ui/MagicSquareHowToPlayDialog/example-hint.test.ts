import {
  inputMagicSquareSessionValue,
  selectMagicSquareSessionCell,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";
import { createMagicSquareExampleSession } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import {
  createMagicSquareExampleHintProgress,
  findMagicSquareExampleHint,
  followMagicSquareExampleHint,
  type MagicSquareExampleGroupState,
  type MagicSquareExampleHintProgress,
  type MagicSquareExamplePress,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-hint";

const emptyRows = [". . . .", ". . . .", ". . . ."];
const region = { row: 0, column: 0, rowCount: 1, columnCount: 4 };

/** 1行目が「14（最初から置いてある数） 4 5 空き」の盤面。 */
const initial: MagicSquareExampleGroupState = {
  sessions: [
    createMagicSquareExampleSession({
      region,
      rows: ["14 +4 +5 .", ...emptyRows],
    }),
  ],
  inputMode: "value",
};

const selectEmptyCell: MagicSquareExamplePress = {
  kind: "cell",
  board: 0,
  cellIndex: 3,
};
const placeAnswer: MagicSquareExamplePress = {
  kind: "value",
  board: 0,
  value: 11,
};
const hints = [selectEmptyCell, placeAnswer];

/** 押した後の面の状態。マスの選びと数は本番のプレイと同じ関数で、押した盤面に入れる。 */
function press(
  state: MagicSquareExampleGroupState,
  pressed: MagicSquareExamplePress,
): MagicSquareExampleGroupState {
  function update(
    board: number,
    operate: (
      session: MagicSquareExampleGroupState["sessions"][number],
    ) => MagicSquareExampleGroupState["sessions"][number],
  ): MagicSquareExampleGroupState {
    return {
      ...state,
      sessions: state.sessions.map((session, index) =>
        index === board ? operate(session) : session,
      ),
    };
  }
  switch (pressed.kind) {
    case "cell":
      return update(pressed.board, (session) =>
        selectMagicSquareSessionCell(session, pressed.cellIndex),
      );
    case "memo":
      return {
        ...state,
        inputMode: state.inputMode === "memo" ? "value" : "memo",
      };
    case "undo":
      return update(pressed.board, undoMagicSquareSession);
    case "value":
      return update(
        pressed.board,
        (session) =>
          inputMagicSquareSessionValue(
            session,
            state.inputMode,
            pressed.value,
            0,
          ).session,
      );
  }
}

/** 押す手を順に押し、最後の面の状態と手がかりの進み具合を返す。 */
function pressAll(
  presses: readonly MagicSquareExamplePress[],
  hintPresses: readonly MagicSquareExamplePress[] = hints,
): {
  state: MagicSquareExampleGroupState;
  progress: MagicSquareExampleHintProgress;
} {
  return presses.reduce(
    ({ state, progress }, pressed) => {
      const next = press(state, pressed);
      return {
        state: next,
        progress: followMagicSquareExampleHint(
          hintPresses,
          progress,
          pressed,
          state,
          next,
          initial,
        ),
      };
    },
    {
      state: initial,
      progress: createMagicSquareExampleHintProgress(initial),
    },
  );
}

function findHint(
  presses: readonly MagicSquareExamplePress[],
  hintPresses: readonly MagicSquareExamplePress[] = hints,
) {
  const { state, progress } = pressAll(presses, hintPresses);
  return findMagicSquareExampleHint(hintPresses, progress, state);
}

describe("findMagicSquareExampleHint", () => {
  test("最初は、最初の手のマスを出すこと", () => {
    expect(findHint([])).toEqual(selectEmptyCell);
  });

  test("手がかりのマスを選ぶと、次の手の数を出すこと", () => {
    expect(findHint([selectEmptyCell])).toEqual(placeAnswer);
  });

  test("手がかりのマスを選んだ後に別のマスを選ぶと、選ぶマスへ手がかりを戻すこと", () => {
    const hint = findHint([
      selectEmptyCell,
      { kind: "cell", board: 0, cellIndex: 1 },
    ]);

    expect(hint).toEqual(selectEmptyCell);
  });

  test("手がかりの手を押し終えると、出さないこと", () => {
    expect(findHint(hints)).toBeNull();
  });

  test("手がかりから外れた数を置くと、盤面が手がかりの姿から離れるので出さないこと", () => {
    const hint = findHint([
      selectEmptyCell,
      { kind: "value", board: 0, value: 12 },
    ]);

    expect(hint).toBeNull();
  });

  test("手がかりから外れた数を外して最初の盤面に戻ると、選んだままのマスの次の手から出し直すこと", () => {
    const hint = findHint([
      selectEmptyCell,
      { kind: "value", board: 0, value: 12 },
      { kind: "value", board: 0, value: 12 },
    ]);

    expect(hint).toEqual(placeAnswer);
  });
});

describe("手がかりの手から外れた後に、手がかりの次の手と同じ所を押した場合", () => {
  const replaceHints: readonly MagicSquareExamplePress[] = [
    selectEmptyCell,
    placeAnswer,
    { kind: "value", board: 0, value: 9 },
  ];

  test("外れた盤面のままでは進めず、手がかりを出さないこと", () => {
    const hint = findHint(
      [selectEmptyCell, { kind: "value", board: 0, value: 12 }, placeAnswer],
      replaceHints,
    );

    expect(hint).toBeNull();
  });

  test("メモの入れ方で外れたメモを書いた後に、手がかりの数を押しても進めないこと", () => {
    const memoHints: readonly MagicSquareExamplePress[] = [
      selectEmptyCell,
      { kind: "memo" },
      { kind: "value", board: 0, value: 11 },
      { kind: "value", board: 0, value: 11 },
    ];

    const hint = findHint(
      [
        selectEmptyCell,
        { kind: "memo" },
        { kind: "value", board: 0, value: 1 },
        { kind: "value", board: 0, value: 11 },
      ],
      memoHints,
    );

    expect(hint).toBeNull();
  });

  test("外れた手を取り消して手がかりの姿に戻ると、同じ手からまた出すこと", () => {
    const hint = findHint(
      [
        selectEmptyCell,
        placeAnswer,
        { kind: "value", board: 0, value: 12 },
        { kind: "undo", board: 0 },
      ],
      replaceHints,
    );

    expect(hint).toEqual(replaceHints[2]);
  });
});

describe("受け付けられない手が手がかりの手の場合", () => {
  const givenHints: readonly MagicSquareExamplePress[] = [
    { kind: "cell", board: 0, cellIndex: 0 },
    { kind: "value", board: 0, value: 6 },
    { kind: "cell", board: 0, cellIndex: 2 },
    { kind: "value", board: 0, value: 6 },
  ];

  test("受け付けられなくても進め、次の手を出すこと", () => {
    const hint = findHint(givenHints.slice(0, 2), givenHints);

    expect(hint).toEqual(givenHints[2]);
  });

  test("手がかりの外の数を押して受け付けられなかったときは進めないこと", () => {
    const hint = findHint(
      [givenHints[0]!, { kind: "value", board: 0, value: 7 }],
      givenHints,
    );

    expect(hint).toEqual(givenHints[1]);
  });
});

describe("待ったで手がかりの姿へ戻した場合", () => {
  test("手がかりから外れた数を待ったで外すと、選んだままのマスの次の手から出し直すこと", () => {
    const hint = findHint([
      selectEmptyCell,
      { kind: "value", board: 0, value: 12 },
      { kind: "undo", board: 0 },
    ]);

    expect(hint).toEqual(placeAnswer);
  });
});
