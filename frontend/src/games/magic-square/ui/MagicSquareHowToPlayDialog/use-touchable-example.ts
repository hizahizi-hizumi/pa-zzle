import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import {
  inputMagicSquareValue,
  type MagicSquareOperation,
} from "@/games/magic-square/play/use-magic-square-play";
import type { MagicSquareValueState } from "@/games/magic-square/puzzle/rules";
import {
  canUndoMagicSquareSession,
  deselectMagicSquareSessionCell,
  listMagicSquareSessionValueStates,
  type MagicSquareSession,
  selectMagicSquareSessionCell,
  undoMagicSquareSession,
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
import { useMagicSquareExampleSelection } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-selection";
import { useMagicSquareSoundEffects } from "@/games/magic-square/ui/use-magic-square-sound-effects";

type MagicSquareTouchableExample = {
  state: MagicSquareExampleGroupState;
  /** 盤面ごとの、その盤面の下に並んだ数の状態。その盤面で選んだマスと、面の入れ方から求める。 */
  valueStatesFor: (board: number) => readonly MagicSquareValueState[];
  hint: MagicSquareExamplePress | null;
  /** 押した結果の知らせ。受け付けなかったときの揺れと、効果音に使う。 */
  operation: MagicSquareOperation | null;
  /** 最後に押した結果がどの盤面のものか。受け付けなかったときに、その盤面か、その下の数の札を揺らす。 */
  operationBoard: number | null;
  /** 面のどれかの盤面を解き終えたか。本番と同じく、解き終えた後は押しても何も起きない。 */
  cleared: boolean;
  /** その盤面で、待ったで戻せる盤面操作があるか。 */
  canUndoFor: (board: number) => boolean;
  selectCell: (board: number, cellIndex: number) => void;
  enterValue: (board: number, value: number) => void;
  toggleMemoInput: () => void;
  undo: (board: number) => void;
};

function createInitialState(
  boards: readonly MagicSquareHowToPlayBoard[],
): MagicSquareExampleGroupState {
  return {
    sessions: boards.map(createMagicSquareExampleSession),
    inputMode: "value",
  };
}

function differsFromInitial(
  state: MagicSquareExampleGroupState,
  initial: MagicSquareExampleGroupState,
): boolean {
  return (
    state.inputMode !== initial.inputMode ||
    state.sessions.some((session, index) => {
      const initialSession = initial.sessions[index];
      return (
        session.selectedCellIndex !== null ||
        initialSession === undefined ||
        !isSameMagicSquareExampleBoard(session, initialSession)
      );
    })
  );
}

function replaceSession(
  state: MagicSquareExampleGroupState,
  board: number,
  session: MagicSquareSession,
): MagicSquareExampleGroupState {
  return {
    ...state,
    sessions: state.sessions.map((current, index) =>
      index === board ? session : current,
    ),
  };
}

/**
 * 触れる例の面の状態。面に並べた盤面ごとに、本番の画面を1つずつ並べた形で、その盤面の選んだマスと、盤面の下に並んだ数と待ったを持つ。
 * 選んだマスは、本番と同じく遊び方の中で1つだけにし、ほかの盤面やほかの例でマスを選んだら、この例の選びを外す。メモの切り替えは面に1つ持つ。本番と同じく、マスを選んでから数を押して置く・外す・メモを書く。盤面の下に並んだ数と待ったは
 * その盤面に効き、その盤面のマスを選ばずに数を押すと、本番でマスを選ばずに数を押したときと同じく受け付けない。
 * 遷移・受け付けない押し方・音は、本番のプレイと同じ関数と効果音のフックで求める。盤面を解き終えたら、本番と同じくクリアの音を鳴らし、
 * その後は押しても何も起きない。
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
  const [operationBoard, setOperationBoard] = useState<number | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();
  const cleared = state.sessions.some(({ status }) => status === "cleared");

  // 本番と同じく、解き終えた描画でクリアの音を鳴らす。例には結果の画面が無いので、解き終えた後はクリアの演出の段のままにする。
  useMagicSquareSoundEffects(operation, cleared ? "clearing" : "playing");

  function apply(
    press: MagicSquareExamplePress,
    next: MagicSquareExampleGroupState,
  ) {
    setState(next);
    setHintProgress(
      followMagicSquareExampleHint(
        hints,
        hintProgress,
        press,
        state,
        next,
        initial,
      ),
    );
    reportChange(differsFromInitial(next, initial));
  }

  function nextOperationId(): number {
    operationIdRef.current += 1;
    return operationIdRef.current;
  }

  // ほかの例でマスを選んだら、この例の選びを外す。本番と同じく、マスを選び直したら前の押した結果の知らせを消す。
  const announceSelection = useMagicSquareExampleSelection(() => {
    if (
      state.sessions.every(
        ({ selectedCellIndex }) => selectedCellIndex === null,
      )
    ) {
      return;
    }
    const next = {
      ...state,
      sessions: state.sessions.map(deselectMagicSquareSessionCell),
    };
    setState(next);
    setOperation(null);
    reportChange(differsFromInitial(next, initial));
  });

  // 本番の画面で選べるマスは1つなので、ほかの盤面のマスを選んだら、前に選んでいた盤面の選びを外す。
  function selectCell(board: number, cellIndex: number) {
    if (cleared || state.sessions[board] === undefined) {
      return;
    }
    announceSelection();
    // 本番と同じく、盤面の操作が変わったら前の押した結果の知らせを消す。
    setOperation(null);
    apply(
      { kind: "cell", board, cellIndex },
      {
        ...state,
        sessions: state.sessions.map((session, index) =>
          index === board
            ? selectMagicSquareSessionCell(session, cellIndex)
            : deselectMagicSquareSessionCell(session),
        ),
      },
    );
  }

  function enterValue(board: number, value: number) {
    const session = state.sessions[board];
    if (cleared || session === undefined) {
      return;
    }
    const input = inputMagicSquareValue(
      session,
      state.inputMode,
      value,
      0,
      nextOperationId(),
    );
    setOperationBoard(board);
    setOperation(input.operation);
    apply(
      { kind: "value", board, value },
      input.operation.type === "rejected"
        ? state
        : replaceSession(state, board, input.session),
    );
  }

  function toggleMemoInput() {
    if (cleared) {
      return;
    }
    apply(
      { kind: "memo" },
      { ...state, inputMode: state.inputMode === "memo" ? "value" : "memo" },
    );
  }

  function canUndoFor(board: number): boolean {
    const session = state.sessions[board];
    return (
      !cleared && session !== undefined && canUndoMagicSquareSession(session)
    );
  }

  // 待ったは、本番と同じく音も揺れも返さず、その盤面の直前の盤面操作を取り消す。
  function undo(board: number) {
    const session = state.sessions[board];
    if (session === undefined || !canUndoFor(board)) {
      return;
    }
    setOperation(null);
    apply(
      { kind: "undo", board },
      replaceSession(state, board, undoMagicSquareSession(session)),
    );
  }

  function valueStatesFor(board: number): readonly MagicSquareValueState[] {
    const session = state.sessions[board];
    return session === undefined
      ? []
      : listMagicSquareSessionValueStates(session, state.inputMode);
  }

  return {
    state,
    valueStatesFor,
    hint: findMagicSquareExampleHint(hints, hintProgress, state),
    operation,
    operationBoard,
    cleared,
    canUndoFor,
    selectCell,
    enterValue,
    toggleMemoInput,
    undo,
  };
}
