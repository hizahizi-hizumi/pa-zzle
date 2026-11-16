import { useCallback, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { isSlidePuzzleSolved } from "@/games/slide-puzzle/puzzle/state";
import {
  createSlidePuzzleExampleState,
  isSameSlidePuzzleBoard,
  type SlidePuzzleExampleState,
  type SlidePuzzleHowToPlayExample,
  tapSlidePuzzleExampleTile,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/example-board";
import { useSlidePuzzleSoundEffects } from "@/games/slide-puzzle/ui/use-slide-puzzle-sound-effects";

type SlidePuzzleTouchableExample = {
  state: SlidePuzzleExampleState;
  /** 本番の盤面へ渡す、直前の操作の知らせ。スライドと揺れに使う。 */
  operation: SlidePuzzleOperation | null;
  /** 押して完成させた盤面に、本番のクリアの波を返している間か。 */
  clearing: boolean;
  tap: (cellIndex: number) => void;
  finishClearing: () => void;
};

/**
 * 触れる例の状態。本番の盤面と同じく、押したタイルをスライドさせるか揺らし、押して完成させたら本番のクリアの波と音を返す。
 * 本番はクリアすると盤面を閉じるが、例では波を返し終えたらまた押せるようにし、元に戻すボタンに頼らず触り続けられるようにする。
 * 音は本番と同じフックで鳴らすので、動きを減らす設定では本番と同じく動かないタイルの音を鳴らさない。
 * `example` は最初の描画のときだけ読む。押すたびに、盤面が最初と違うかを例を並べる面に知らせる。
 */
export function useTouchableExample(
  example: SlidePuzzleHowToPlayExample,
): SlidePuzzleTouchableExample {
  const [state, setState] = useState(() =>
    createSlidePuzzleExampleState(example),
  );
  const [operation, setOperation] = useState<SlidePuzzleOperation | null>(null);
  const [clearing, setClearing] = useState(false);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  useSlidePuzzleSoundEffects(
    operation,
    clearing ? "clearing" : "playing",
    state.board.length - 1,
  );

  function tap(cellIndex: number): void {
    const next = tapSlidePuzzleExampleTile(state, cellIndex);
    const move = next.lastMove;
    if (next === state || move === null) {
      return;
    }
    operationIdRef.current += 1;
    const id = operationIdRef.current;
    const solved = move.type === "slid" && isSlidePuzzleSolved(next.board);
    setOperation(
      move.type === "slid"
        ? {
            id,
            type: "slid",
            slide: move.slide,
            boardBefore: move.boardBefore,
            boardAfter: next.board,
            isClearingMove: solved,
          }
        : { id, type: "invalid", tileIndex: move.tileIndex },
    );
    setState(next);
    setClearing(solved);
    reportChange(!isSameSlidePuzzleBoard(next.board, example.board));
  }

  const finishClearing = useCallback(() => setClearing(false), []);

  return { state, operation, clearing, tap, finishClearing };
}
