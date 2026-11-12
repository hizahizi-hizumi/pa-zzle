import { type RefObject, useEffect, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/use-water-sort-sound-effects";
import type { WaterSortHowToPlayExample } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { onHowToPlayScroll } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/how-to-play-scroll";
import {
  createWaterSortExampleBoard,
  isSameWaterSortState,
  tapWaterSortExampleBottle,
  type WaterSortExampleBoard,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample/example-board";

type WaterSortTouchableExample = {
  board: WaterSortExampleBoard;
  /** 本番の盤面へ渡す、直前の操作の知らせ。選ぶ・注ぐ・揺れる動きに使う。 */
  operation: WaterSortOperation | null;
  /** 例の盤面に付ける。盤面を含む領域が送られたら、注ぐ動きを止める。 */
  boardRef: RefObject<HTMLDivElement | null>;
  tap: (bottleIndex: number) => void;
};

/**
 * 触れる例の状態。本番の盤面と同じく、押したボトルを選び、注ぎ、受け付けないボトルは揺らす。
 * 音は本番と同じフックで鳴らすので、動きを減らす設定では本番と同じく通らない音を鳴らさない。
 * 例は解き終える盤面ではないので、クリア音は鳴らさない。
 * `example` は最初の描画のときだけ読み、変わっても例を作り直さない。
 * 押すたびに、ボトルの中身が最初と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * 注ぐボトルを選んだ・選ぶのをやめただけでは変わったとみなさない。選ぶかどうかは、そのボトルをもう一度押せば戻せるため。
 */
export function useTouchableExample(
  example: WaterSortHowToPlayExample,
): WaterSortTouchableExample {
  const [board, setBoard] = useState(() =>
    createWaterSortExampleBoard(example),
  );
  const [operation, setOperation] = useState<WaterSortOperation | null>(null);
  const operationIdRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const reportChange = useReportHowToPlayExampleChange();

  useWaterSortSoundEffects(operation, "playing");

  const pouring = operation?.type === "poured";
  // 注ぐ動きは画面の座標で描くので、盤面を送ると盤面から外れる。送ったら動きを止め、注いだ後の姿を見せる。
  useEffect(() => {
    const element = boardRef.current;
    if (!pouring || element === null) {
      return;
    }
    return onHowToPlayScroll(element, () => setOperation(null));
  }, [pouring]);

  function tap(bottleIndex: number): void {
    const { board: next, selection } = tapWaterSortExampleBottle(
      board,
      bottleIndex,
    );
    operationIdRef.current += 1;
    const id = operationIdRef.current;
    setOperation(
      selection.type === "pour"
        ? {
            id,
            type: "poured",
            ...selection.move,
            stateBefore: board.bottles,
            stateAfter: next.bottles,
            isClearingMove: false,
          }
        : { id, ...selection },
    );
    setBoard(next);
    reportChange(!isSameWaterSortState(next.bottles, example.bottles));
  }

  return {
    board,
    operation,
    boardRef,
    tap,
  };
}
