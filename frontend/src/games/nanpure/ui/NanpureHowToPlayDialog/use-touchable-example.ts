import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { NanpureOperation } from "@/games/nanpure/play/use-nanpure-play";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import {
  clearNanpureSessionCell,
  type NanpureSession,
} from "@/games/nanpure/session/session";
import {
  createNanpureExampleSession,
  getNanpureExampleInputAvailability,
  inputNanpureExampleDigit,
  isSameNanpureExampleBoard,
  type NanpureExampleInputAvailability,
  type NanpureHowToPlayBoard,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import {
  createNanpureExampleHintProgress,
  findNanpureExampleHint,
  followNanpureExampleHint,
  type NanpureExampleGroupState,
  type NanpureExampleHintProgress,
  type NanpureExamplePress,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-hint";
import { useNanpureSoundEffects } from "@/games/nanpure/ui/use-nanpure-sound-effects";

type NanpureTouchableExample = {
  state: NanpureExampleGroupState;
  /** 選んでいる盤面に対して押せるボタン。マスを選んでいないときは、最初の盤面に対して求める。 */
  availability: NanpureExampleInputAvailability;
  hint: NanpureExamplePress | null;
  selectCell: (board: number, cellIndex: number) => void;
  inputDigit: (digit: NanpureDigit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
};

function createInitialState(
  boards: readonly NanpureHowToPlayBoard[],
): NanpureExampleGroupState {
  return {
    sessions: boards.map(createNanpureExampleSession),
    selection: null,
    notesMode: false,
  };
}

function differsFromInitial(
  state: NanpureExampleGroupState,
  initial: NanpureExampleGroupState,
): boolean {
  return (
    state.selection !== null ||
    state.notesMode !== initial.notesMode ||
    state.sessions.some((session, index) => {
      const initialSession = initial.sessions[index];
      return (
        initialSession === undefined ||
        !isSameNanpureExampleBoard(session, initialSession)
      );
    })
  );
}

/**
 * 触れる例の面の状態。面に並べた盤面と、本番と同じ入力の段（数字・消す・メモ）を1組で持つ。
 * 本番と同じく、マスを選んでから数字を押して入れる。選べるマスは面の中で1つだけにし、入力の段は選んでいる盤面に効く。
 * 遷移と音は本番のプレイと同じ session の関数と効果音のフックで求める。例は解き終える盤面ではないので、クリア音は鳴らさない。
 * 押すたびに、最初の姿から変わったか（マスを選んだことも含む）を面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function useTouchableExample(
  boards: readonly NanpureHowToPlayBoard[],
  hints: readonly NanpureExamplePress[],
): NanpureTouchableExample {
  const [initial] = useState(() => createInitialState(boards));
  const [state, setState] = useState(initial);
  const [hintProgress, setHintProgress] = useState<NanpureExampleHintProgress>(
    () => createNanpureExampleHintProgress(initial),
  );
  const [operation, setOperation] = useState<NanpureOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  useNanpureSoundEffects(operation, "playing");

  function apply(press: NanpureExamplePress, next: NanpureExampleGroupState) {
    setState(next);
    setHintProgress(
      followNanpureExampleHint(hints, hintProgress, press, next, initial),
    );
    reportChange(differsFromInitial(next, initial));
  }

  function notify(type: NanpureOperation["type"]) {
    operationIdRef.current += 1;
    setOperation({ id: operationIdRef.current, type });
  }

  function selectCell(board: number, cellIndex: number) {
    apply(
      { kind: "cell", board, cellIndex },
      {
        ...state,
        selection: { board, cellIndex },
      },
    );
  }

  /** マスを選んでいる盤面と、選んでいるマス。マスを選んでいないときは `null`。 */
  function findSelectedSession(): {
    board: number;
    cellIndex: number;
    session: NanpureSession;
  } | null {
    const { selection } = state;
    const session =
      selection === null ? undefined : state.sessions[selection.board];
    return selection === null || session === undefined
      ? null
      : { ...selection, session };
  }

  /** 選んでいる盤面を `next` に替えた面の状態。 */
  function withSession(board: number, next: NanpureSession) {
    return {
      ...state,
      sessions: state.sessions.map((current, index) =>
        index === board ? next : current,
      ),
    };
  }

  function inputDigit(digit: NanpureDigit) {
    const selected = findSelectedSession();
    if (selected === null) {
      return;
    }
    const { session, sound } = inputNanpureExampleDigit(
      selected.session,
      selected.cellIndex,
      digit,
      state.notesMode,
    );
    // 音が無いのは、盤面が変わらなかったときだけ。
    if (sound === null) {
      return;
    }
    apply({ kind: "digit", digit }, withSession(selected.board, session));
    notify(sound);
  }

  function erase() {
    const selected = findSelectedSession();
    if (selected === null) {
      return;
    }
    const session = clearNanpureSessionCell(
      selected.session,
      selected.cellIndex,
    );
    if (session !== selected.session) {
      apply({ kind: "erase" }, withSession(selected.board, session));
    }
  }

  function toggleNotesMode() {
    apply({ kind: "notes" }, { ...state, notesMode: !state.notesMode });
  }

  const selectedSession = state.sessions[state.selection?.board ?? 0];
  const availability =
    selectedSession === undefined
      ? { canEnterDigit: false, canErase: false, completedDigits: [] }
      : getNanpureExampleInputAvailability(
          selectedSession,
          state.selection?.cellIndex ?? null,
          state.notesMode,
        );

  return {
    state,
    availability,
    hint: findNanpureExampleHint(hints, hintProgress, state),
    selectCell,
    inputDigit,
    erase,
    toggleNotesMode,
  };
}
