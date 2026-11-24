import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireHowToPlayExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import {
  createSolitaireExampleBoard,
  hasExampleBoardChanged,
  pressSolitaireExamplePile,
  type SolitaireExampleBoard,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/example-board";

type SolitaireTouchableExample = {
  board: SolitaireExampleBoard;
  /** 本番の盤面へ渡す、直前の操作の知らせ。札が移る・当てて戻る・揺れる動きに使う。 */
  operation: SolitaireOperation | null;
  press: (pile: SolitairePile) => void;
};

/**
 * 触れる例の状態。本番のプレイと同じく、押した山を選び、手を打ち、受け付けない山には当てて戻すか揺らす。
 * `example` は最初の描画のときだけ読み、変わっても例を作り直さない。
 * 押すたびに、盤面が最初と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function useTouchableExample(
  example: SolitaireHowToPlayExample,
): SolitaireTouchableExample {
  const [board, setBoard] = useState(() =>
    createSolitaireExampleBoard(example),
  );
  const [operation, setOperation] = useState<SolitaireOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  function press(pile: SolitairePile): void {
    const { board: next, selection } = pressSolitaireExamplePile(board, pile);
    operationIdRef.current += 1;
    const id = operationIdRef.current;
    setOperation(
      selection.type === "move"
        ? {
            id,
            type: "moved",
            move: selection.move,
            stateBefore: board.state,
            isClearingMove: false,
          }
        : { id, ...selection },
    );
    setBoard(next);
    reportChange(hasExampleBoardChanged(next, example));
  }

  return { board, operation, press };
}
