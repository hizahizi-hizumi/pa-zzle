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
function pressAll(presses: readonly MagicSquareExamplePress[]): {
  state: MagicSquareExampleGroupState;
  progress: MagicSquareExampleHintProgress;
} {
  return presses.reduce(
    ({ state, progress }, pressed) => {
      const next = press(state, pressed);
      return {
        state: next,
        progress: followMagicSquareExampleHint(
          hints,
          progress,
          pressed,
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

function findHint(presses: readonly MagicSquareExamplePress[]) {
  const { state, progress } = pressAll(presses);
  return findMagicSquareExampleHint(hints, progress, state);
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

describe("受け付けられない手がかりの手を押した場合", () => {
  const givenHints: readonly MagicSquareExamplePress[] = [
    { kind: "cell", board: 0, cellIndex: 0 },
    { kind: "value", board: 0, value: 6 },
  ];

  function findGivenHint(presses: readonly MagicSquareExamplePress[]) {
    let state = initial;
    let progress = createMagicSquareExampleHintProgress(initial);
    for (const pressed of presses) {
      const next = press(state, pressed);
      progress = followMagicSquareExampleHint(
        givenHints,
        progress,
        pressed,
        next,
        initial,
      );
      state = next;
    }
    return findMagicSquareExampleHint(givenHints, progress, state);
  }

  test("盤面が変わらないまま、手がかりを出さないこと", () => {
    expect(findGivenHint(givenHints)).toBeNull();
  });

  test("続けて手がかりの外の数を押して、また受け付けられなくても、出さないままにすること", () => {
    const hint = findGivenHint([
      ...givenHints,
      { kind: "value", board: 0, value: 7 },
    ]);

    expect(hint).toBeNull();
  });

  test("マスを選び直すと、また出すこと", () => {
    const hint = findGivenHint([
      ...givenHints,
      { kind: "cell", board: 0, cellIndex: 0 },
    ]);

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
