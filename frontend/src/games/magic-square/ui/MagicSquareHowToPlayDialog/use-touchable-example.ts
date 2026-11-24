import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import {
  inputMagicSquareValue,
  type MagicSquareOperation,
} from "@/games/magic-square/play/use-magic-square-play";
import type { MagicSquareValueState } from "@/games/magic-square/puzzle/rules";
import {
  listMagicSquareSessionValueStates,
  type MagicSquareSession,
  selectMagicSquareSessionCell,
} from "@/games/magic-square/session/session";
import {
  createMagicSquareExampleSession,
  isSameMagicSquareExampleBoard,
  type MagicSquareHowToPlayBoard,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import {
  createMagicSquareExampleHintProgress,
  findMagicSquareExampleHint,
  followMagicSquareExampleHint,
  type MagicSquareExampleGroupState,
  type MagicSquareExampleHintProgress,
  type MagicSquareExamplePress,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-hint";
import { useMagicSquareSoundEffects } from "@/games/magic-square/ui/use-magic-square-sound-effects";

type MagicSquareTouchableExample = {
  state: MagicSquareExampleGroupState;
  /** 数の欄の状態。選んでいる盤面に対して求め、マスを選んでいないときは最初の盤面に対して求める。 */
  valueStates: readonly MagicSquareValueState[];
  hint: MagicSquareExamplePress | null;
  /** 押した結果の知らせ。受け付けなかったときの揺れと、効果音に使う。 */
  operation: MagicSquareOperation | null;
  selectCell: (board: number, cellIndex: number) => void;
  enterValue: (value: number) => void;
  toggleMemoInput: () => void;
};

function createInitialState(
  boards: readonly MagicSquareHowToPlayBoard[],
): MagicSquareExampleGroupState {
  return {
    sessions: boards.map(createMagicSquareExampleSession),
    selection: null,
    inputMode: "value",
  };
}

function differsFromInitial(
  state: MagicSquareExampleGroupState,
  initial: MagicSquareExampleGroupState,
): boolean {
  return (
    state.selection !== null ||
    state.inputMode !== initial.inputMode ||
    state.sessions.some((session, index) => {
      const initialSession = initial.sessions[index];
      return (
        initialSession === undefined ||
        !isSameMagicSquareExampleBoard(session, initialSession)
      );
    })
  );
}

/** 盤面の session に、面の中で選んでいるマスを持たせる。その盤面のマスを選んでいなければ、どのマスも選んでいない姿にする。 */
export function withExampleSelection(
  session: MagicSquareSession,
  state: MagicSquareExampleGroupState,
  board: number,
): MagicSquareSession {
  const cellIndex =
    state.selection?.board === board ? state.selection.cellIndex : null;
  return cellIndex === null
    ? { ...session, selectedCellIndex: null }
    : selectMagicSquareSessionCell(session, cellIndex);
}

/**
 * 触れる例の面の状態。面に並べた盤面と、本番と同じ数の欄とメモの切り替えを1組で持つ。
 * 本番と同じく、マスを選んでから数を押して置く・外す・メモを書く。選べるマスは面の中で1つだけにし、数の欄は選んでいる盤面に効く。
 * 遷移・受け付けない押し方・音は、本番のプレイと同じ関数と効果音のフックで求める。例は解き終える盤面ではないので、クリア音は鳴らさない。
 * 押すたびに、最初の姿から変わったか（マスを選んだことも含む）を面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function useTouchableExample(
  boards: readonly MagicSquareHowToPlayBoard[],
  hints: readonly MagicSquareExamplePress[],
): MagicSquareTouchableExample {
  const [initial] = useState(() => createInitialState(boards));
  const [state, setState] = useState(initial);
  const [hintProgress, setHintProgress] =
    useState<MagicSquareExampleHintProgress>(() =>
      createMagicSquareExampleHintProgress(initial),
    );
  const [operation, setOperation] = useState<MagicSquareOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  useMagicSquareSoundEffects(operation, "playing");

  function apply(
    press: MagicSquareExamplePress,
    next: MagicSquareExampleGroupState,
  ) {
    setState(next);
    setHintProgress(
      followMagicSquareExampleHint(hints, hintProgress, press, next, initial),
    );
    reportChange(differsFromInitial(next, initial));
  }

  function nextOperationId(): number {
    operationIdRef.current += 1;
    return operationIdRef.current;
  }

  function selectCell(board: number, cellIndex: number) {
    // 本番と同じく、盤面の操作が変わったら前の押した結果の知らせを消す。
    setOperation(null);
    apply(
      { kind: "cell", board, cellIndex },
      { ...state, selection: { board, cellIndex } },
    );
  }

  function enterValue(value: number) {
    const { selection } = state;
    const session =
      selection === null ? undefined : state.sessions[selection.board];
    if (selection === null || session === undefined) {
      setOperation({
        id: nextOperationId(),
        type: "rejected",
        cellIndex: null,
        value,
      });
      apply({ kind: "value", value }, state);
      return;
    }
    const input = inputMagicSquareValue(
      withExampleSelection(session, state, selection.board),
      state.inputMode,
      value,
      0,
    );
    if (input.type === "rejected") {
      setOperation({
        id: nextOperationId(),
        type: "rejected",
        cellIndex: selection.cellIndex,
        value,
      });
      apply({ kind: "value", value }, state);
      return;
    }
    setOperation({
      id: nextOperationId(),
      type: input.type,
      cellIndex: selection.cellIndex,
      value,
    });
    apply(
      { kind: "value", value },
      {
        ...state,
        sessions: state.sessions.map((current, index) =>
          index === selection.board ? input.session : current,
        ),
      },
    );
  }

  function toggleMemoInput() {
    apply(
      { kind: "memo" },
      { ...state, inputMode: state.inputMode === "memo" ? "value" : "memo" },
    );
  }

  const selectedBoard = state.selection?.board ?? 0;
  const selectedSession = state.sessions[selectedBoard];
  const valueStates =
    selectedSession === undefined
      ? []
      : listMagicSquareSessionValueStates(
          withExampleSelection(selectedSession, state, selectedBoard),
          state.inputMode,
        );

  return {
    state,
    valueStates,
    hint: findMagicSquareExampleHint(hints, hintProgress, state),
    operation,
    selectCell,
    enterValue,
    toggleMemoInput,
  };
}
