import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

import { useTouchTap } from "@/components/touch-tap";
import type { FukumenzanCrossUndoNotice } from "@/games/fukumenzan/play/use-fukumenzan-play";
import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";

/**
 * 押して選んでいるもの。札を選んでから文字を押すと札を入れ、文字を選んでから札を押すとその文字の札に × を付け外しする。
 * 札の入った文字を選んでから列の空いた所を押すと、札を列へ戻す。
 */
export type FukumenzanSelection =
  | { kind: "letter"; letter: number }
  | { kind: "card"; digit: FukumenzanDigit }
  | null;

/** 運んでいる札。`x`・`y` は運んでいる札を描く中心の、画面上の位置。 */
export type FukumenzanCardDrag = {
  digit: FukumenzanDigit;
  fromLetter: number | null;
  x: number;
  y: number;
  /** 指の下にある文字。離すとこの文字に入る。 */
  overLetter: number | null;
};

type PendingDrag = {
  pointerId: number;
  digit: FukumenzanDigit;
  fromLetter: number | null;
  startX: number;
  startY: number;
  lift: number;
  active: boolean;
};

export type FukumenzanInputHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
};

/** 押すと運ぶを分ける、指が動いた距離。 */
const DRAG_THRESHOLD_PX = 8;
/**
 * 指で隠れないよう、タッチで運ぶ札を指より上に描く距離（札の中心まで）。落とし先は指の下で決め、その文字に輪郭を付けて示す。
 * 落とし先を描いた札の下で決めると、指で狙った文字の1段上の文字に入ってしまう。
 */
const TOUCH_DRAG_LIFT_PX = 56;

const LETTER_ATTRIBUTE = "data-fukumenzan-letter";
const CARD_ROW_ATTRIBUTE = "data-fukumenzan-card-row";

export const fukumenzanDropTargetAttributes = {
  letter(letter: number) {
    return { [LETTER_ATTRIBUTE]: letter };
  },
  cardRow: { [CARD_ROW_ATTRIBUTE]: "" },
} as const;

type DropTarget = { kind: "letter"; letter: number } | { kind: "card-row" };

function findDropTarget(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint?.(x, y) ?? null;
  const letterElement = element?.closest(`[${LETTER_ATTRIBUTE}]`);
  if (letterElement) {
    return {
      kind: "letter",
      letter: Number(letterElement.getAttribute(LETTER_ATTRIBUTE)),
    };
  }
  return element?.closest(`[${CARD_ROW_ATTRIBUTE}]`)
    ? { kind: "card-row" }
    : null;
}

type FukumenzanInputOptions = {
  puzzleState: FukumenzanPuzzleState;
  crossUndoNotice: FukumenzanCrossUndoNotice | null;
  interactionDisabled: boolean;
  onPlaceDigit: (letter: number, digit: FukumenzanDigit) => void;
  onReturnDigit: (letter: number) => void;
  onToggleCross: (letter: number, digit: FukumenzanDigit) => void;
};

/**
 * 式の文字・列の札・列の空いた所への、押す操作と札を運ぶ操作。
 * 押す操作は、隣の札を続けて素早く押しても押した札で受けるよう `useTouchTap` で受ける。
 * 札は押したまま動かすと運べる。運んだ後に同じ押し方から届く click は捨てる。
 */
export function useFukumenzanInput({
  puzzleState,
  crossUndoNotice,
  interactionDisabled,
  onPlaceDigit,
  onReturnDigit,
  onToggleCross,
}: FukumenzanInputOptions) {
  const { getTapHandlers } = useTouchTap();
  const [selection, setSelection] = useState<FukumenzanSelection>(null);
  const [shownCrossUndoId, setShownCrossUndoId] = useState(
    crossUndoNotice?.id ?? null,
  );

  // 待ったで × を戻した文字を選び、札の上で戻った × を見せる。
  if (crossUndoNotice !== null && crossUndoNotice.id !== shownCrossUndoId) {
    setShownCrossUndoId(crossUndoNotice.id);
    setSelection({ kind: "letter", letter: crossUndoNotice.letter });
  }
  const [drag, setDrag] = useState<FukumenzanCardDrag | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const draggedRef = useRef(false);

  const shownSelection = interactionDisabled ? null : selection;

  function drop(pending: PendingDrag, x: number, y: number) {
    const target = findDropTarget(x, y);
    if (target?.kind === "letter") {
      onPlaceDigit(target.letter, pending.digit);
    } else if (target?.kind === "card-row" && pending.fromLetter !== null) {
      onReturnDigit(pending.fromLetter);
    }
  }

  function getHandlers(
    onTap: () => void,
    dragSource: { digit: FukumenzanDigit; fromLetter: number | null } | null,
  ): FukumenzanInputHandlers {
    const tapHandlers = getTapHandlers(() => {
      if (!interactionDisabled) onTap();
    });
    return {
      onPointerDown(event) {
        if (!event.isPrimary) return;
        draggedRef.current = false;
        if (interactionDisabled || dragSource === null || event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pendingRef.current = {
          pointerId: event.pointerId,
          ...dragSource,
          startX: event.clientX,
          startY: event.clientY,
          lift: event.pointerType === "mouse" ? 0 : TOUCH_DRAG_LIFT_PX,
          active: false,
        };
      },
      onPointerMove(event) {
        const pending = pendingRef.current;
        if (pending === null || pending.pointerId !== event.pointerId) return;
        if (
          !pending.active &&
          Math.hypot(
            event.clientX - pending.startX,
            event.clientY - pending.startY,
          ) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        pending.active = true;
        const target = findDropTarget(event.clientX, event.clientY);
        setDrag({
          digit: pending.digit,
          fromLetter: pending.fromLetter,
          x: event.clientX,
          y: event.clientY - pending.lift,
          overLetter: target?.kind === "letter" ? target.letter : null,
        });
      },
      onPointerUp(event) {
        const pending = pendingRef.current;
        if (pending?.pointerId === event.pointerId) {
          pendingRef.current = null;
          if (pending.active) {
            draggedRef.current = true;
            setDrag(null);
            setSelection(null);
            drop(pending, event.clientX, event.clientY);
            return;
          }
        }
        tapHandlers.onPointerUp(event);
      },
      onPointerCancel(event) {
        if (pendingRef.current?.pointerId !== event.pointerId) return;
        pendingRef.current = null;
        setDrag(null);
      },
      onClick(event) {
        if (draggedRef.current && event.detail !== 0) {
          draggedRef.current = false;
          return;
        }
        tapHandlers.onClick(event);
      },
    };
  }

  function getLetterHandlers(letter: number): FukumenzanInputHandlers {
    const placed = puzzleState.placedDigits[letter] ?? null;
    return getHandlers(
      () => {
        if (selection?.kind === "card") {
          onPlaceDigit(letter, selection.digit);
          setSelection(null);
          return;
        }
        setSelection(
          selection?.kind === "letter" && selection.letter === letter
            ? null
            : { kind: "letter", letter },
        );
      },
      placed === null ? null : { digit: placed, fromLetter: letter },
    );
  }

  function getCardHandlers(digit: FukumenzanDigit): FukumenzanInputHandlers {
    return getHandlers(
      () => {
        if (selection?.kind === "letter") {
          onToggleCross(selection.letter, digit);
          return;
        }
        setSelection(
          selection?.kind === "card" && selection.digit === digit
            ? null
            : { kind: "card", digit },
        );
      },
      { digit, fromLetter: null },
    );
  }

  /** 列の空いた所。札の入った文字を選んでいれば、その札を列へ戻す。 */
  function getEmptySlotHandlers(): FukumenzanInputHandlers {
    return getHandlers(() => {
      if (
        selection?.kind === "letter" &&
        puzzleState.placedDigits[selection.letter] !== null
      ) {
        onReturnDigit(selection.letter);
      }
      setSelection(null);
    }, null);
  }

  return {
    selection: shownSelection,
    drag: interactionDisabled ? null : drag,
    getLetterHandlers,
    getCardHandlers,
    getEmptySlotHandlers,
  };
}
