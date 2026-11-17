import { useCallback, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import { useHowToPlayExampleSelection } from "@/components/how-to-play-example-selection";
import type { GameProgress } from "@/games/play";
import {
  createReflectionOperation,
  type ReflectionOperation,
} from "@/games/reflection/play/use-reflection-play";
import type { ReflectionCueTarget } from "@/games/reflection/ui/board/cue";
import {
  clearReflectionExampleSelection,
  createReflectionExampleBoard,
  hasReflectionExampleChanged,
  type ReflectionExampleBoard,
  removeReflectionExamplePiece,
  tapReflectionExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/example-board";
import type { ReflectionHowToPlayExample } from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import { useReflectionSoundEffects } from "@/games/reflection/ui/use-reflection-sound-effects";

type ReflectionTouchableExample = {
  board: ReflectionExampleBoard;
  progress: GameProgress;
  tap: (target: ReflectionCueTarget) => void;
  removePiece: (cellIndex: number) => void;
  finishClearAnimation: () => void;
};

/**
 * 触れる例の状態。本番の盤面と同じく、押すとピースを選び・置き・動かし、外周の数字を押すと光路を出す。
 * 置いた音と完成の音・演出は、本番と同じ知らせと進み具合で、本番の効果音のフックから鳴らす。
 * `example` は最初の描画のときだけ読み、変わっても例を作り直さない。
 * 押すたびに、始まりの姿から変わったかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function useTouchableExample(
  example: ReflectionHowToPlayExample,
): ReflectionTouchableExample {
  const [board, setBoard] = useState(() =>
    createReflectionExampleBoard(example),
  );
  const [clearAnimationDone, setClearAnimationDone] = useState(false);
  const [operation, setOperation] = useState<ReflectionOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  const progress: GameProgress =
    board.session.status !== "cleared"
      ? "playing"
      : clearAnimationDone
        ? "result"
        : "clearing";

  useReflectionSoundEffects(operation, progress);
  // 本番のプレイ画面は Esc で選んでいる物を解くので、例でも選んでいる間は層に知らせ、Esc で同じ遷移を打つ。
  useHowToPlayExampleSelection(
    board.session.selection !== null,
    cancelSelection,
  );

  function apply(next: ReflectionExampleBoard): void {
    if (next === board) {
      return;
    }
    operationIdRef.current += 1;
    setOperation(
      createReflectionOperation(
        operationIdRef.current,
        board.session,
        next.session,
      ),
    );
    setBoard(next);
    reportChange(hasReflectionExampleChanged(next, example));
  }

  function cancelSelection(): void {
    apply(clearReflectionExampleSelection(board, example));
  }

  const finishClearAnimation = useCallback(
    () => setClearAnimationDone(true),
    [],
  );

  return {
    board,
    progress,
    tap(target) {
      apply(tapReflectionExample(board, example, target));
    },
    removePiece(cellIndex) {
      apply(removeReflectionExamplePiece(board, example, cellIndex));
    },
    finishClearAnimation,
  };
}
