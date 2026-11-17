import { useCallback, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import {
  createIceFloorMazeBlockedInput,
  createIceFloorMazeLastSlide,
  type IceFloorMazeBlockedInput,
  type IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeExampleBoard,
  type IceFloorMazeExampleBoard,
  isIceFloorMazeExampleChanged,
  isIceFloorMazeExampleCleared,
  slideIceFloorMazeExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/example-board";
import type { IceFloorMazeHowToPlayExample } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
import type { GameProgress } from "@/games/play";

/** 盤面へ渡す、例の今の姿と手。 */
type IceFloorMazeTouchableExample = {
  board: IceFloorMazeExampleBoard;
  /** 直前の成立した滑り。本番と同じく、動けなかった手では変えない。 */
  lastSlide: IceFloorMazeLastSlide | null;
  /** 直前の手が動けなかったときだけ値を持つ。 */
  blockedInput: IceFloorMazeBlockedInput | null;
  /** ゴールで止まってから、本番の完成演出を終えるまで `true`。 */
  clearing: boolean;
  /** ゴールで止まった後は、本番と同じく受け付けない。 */
  playing: boolean;
  slide: (direction: IceFloorMazeDirection) => void;
  completeClearAnimation: () => void;
};

/**
 * 触れる例の状態。滑らせる手を本番の `puzzle/` の関数で打ち、本番の盤面部品へ本番のプレイと同じ形の直前の滑りと
 * 動けなかった手を渡すので、滑る・止まる・崩れる・割れる・押し出す・押し戻されるの動きと音が本番と同じになる。
 * ゴールで止まったら本番の完成演出を返し、それからは受け付けない。
 * 手を打つたびに、盤面が最初の姿と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * `example` は最初の描画のときだけ読み、変わっても例を作り直さない。
 */
export function useTouchableExample(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeTouchableExample {
  const [board, setBoard] = useState(() =>
    createIceFloorMazeExampleBoard(example),
  );
  // 1回の描画の間に続けて手を受けても、次の手を今の姿へ当てるため、姿を同時に持つ。
  const boardRef = useRef(board);
  // 手の番号。本番と同じく、手ごとに変え、盤面の動きと効果音に別の手として渡す。
  const inputIdRef = useRef(0);
  const [lastSlide, setLastSlide] = useState<IceFloorMazeLastSlide | null>(
    null,
  );
  const [blockedInput, setBlockedInput] =
    useState<IceFloorMazeBlockedInput | null>(null);
  const [clearAnimationDone, setClearAnimationDone] = useState(false);
  const reportChange = useReportHowToPlayExampleChange();
  const cleared = isIceFloorMazeExampleCleared(board);
  const clearing = cleared && !clearAnimationDone;
  const progress: GameProgress = !cleared
    ? "playing"
    : clearing
      ? "clearing"
      : "result";
  const { goal } = board.example;

  useIceFloorMazeSoundEffects(lastSlide, blockedInput, goal, progress);

  function slide(direction: IceFloorMazeDirection): void {
    const current = boardRef.current;
    const next = slideIceFloorMazeExample(current, direction);
    const input = next.lastInput;
    if (next === current || input === null) {
      return;
    }
    boardRef.current = next;
    setBoard(next);
    inputIdRef.current += 1;
    const id = inputIdRef.current;
    if (input.kind === "blocked") {
      setBlockedInput(
        createIceFloorMazeBlockedInput(next.example.board, input.slide, id),
      );
    } else {
      setBlockedInput(null);
      setLastSlide(
        createIceFloorMazeLastSlide({
          id,
          board: next.example.board,
          goal,
          slide: input.slide,
          isClearingMove: isIceFloorMazeExampleCleared(next),
          // 例ではもうゴールに止まれないことを知らせない。
          entersTrap: false,
        }),
      );
    }
    reportChange(isIceFloorMazeExampleChanged(next));
  }

  const completeClearAnimation = useCallback(() => {
    setClearAnimationDone(true);
  }, []);

  return {
    board,
    lastSlide,
    blockedInput,
    clearing,
    playing: !cleared,
    slide,
    completeClearAnimation,
  };
}
