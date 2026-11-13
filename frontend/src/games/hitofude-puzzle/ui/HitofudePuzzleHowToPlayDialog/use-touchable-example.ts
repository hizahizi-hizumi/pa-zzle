import { useCallback, useEffect, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type {
  HitofudePuzzleBlockedMove,
  HitofudePuzzlePathNotice,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import { BLOCKED_MARK_DURATION_MS } from "@/games/hitofude-puzzle/ui/board/animate-blocked-move";
import {
  createHitofudePuzzleExampleBoard,
  getHitofudePuzzleExamplePath,
  getHitofudePuzzleExampleStatus,
  type HitofudePuzzleExampleBoard,
  isHitofudePuzzleExampleChanged,
  pressHitofudePuzzleExampleCell,
  releaseHitofudePuzzleExample,
  traceHitofudePuzzleExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import type { HitofudePuzzleHowToPlayExample } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import { useHitofudePuzzleSoundEffects } from "@/games/hitofude-puzzle/ui/use-hitofude-puzzle-sound-effects";
import type { GameProgress } from "@/games/play";

/** 盤面へ渡す、例の今の姿と手。 */
export type HitofudePuzzleTouchableExample = {
  example: HitofudePuzzleExampleBoard;
  isDeadEnd: boolean;
  solved: boolean;
  /** 完成してから、本番のクリア演出を終えるまで `true`。 */
  clearing: boolean;
  blockedMove: HitofudePuzzleBlockedMove | null;
  /**
   * 今の道から弾かれた手の、本番の×が点いているマス。×が点いている間だけ持ち、そのマスの手ごとの印を消すのに使う。
   * 弾かれた後に道を変えたら、×はその前の先端から弾かれた手のものなので、×が消える前でも持たない。
   */
  blockedMarkCell: number | null;
  beginStroke: (cell: number) => void;
  traceStroke: (step: HitofudePuzzleTraceStep) => void;
  endStroke: () => void;
  completeClearAnimation: () => void;
};

/** 例の手を、本番と同じ効果音を鳴らす知らせにする。 */
function toPathNotice(
  example: HitofudePuzzleExampleBoard,
  id: number,
): HitofudePuzzlePathNotice | null {
  const move = example.lastMove;
  if (move === null) {
    return null;
  }
  return move.change === "blocked"
    ? { id, change: "blocked", cell: move.cell, reason: move.reason }
    : { id, change: move.change, head: move.head };
}

/**
 * 触れる例の状態。押す・なぞる・離すを本番の session の関数で打つので、本番の指の操作とまったく同じに、なぞると道が延び、
 * 来た道へ戻ると縮み、道のマスを押すとそこまで戻り、延ばせないマスでは×を点けて先端を揺らす。ルールの例も操作の例も同じに動く。
 * すべてのマスを通ったら、本番のクリア演出を返し、それからは受け付けない。
 * 音は本番と同じフックで鳴らすので、動きを減らす設定でも本番と同じ音になる。
 * 道を変えたか弾かれた手のたびに、道が触る前と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * `definition` は最初の描画のときだけ読み、変わっても例を作り直さない。
 */
export function useTouchableExample(
  definition: HitofudePuzzleHowToPlayExample,
): HitofudePuzzleTouchableExample {
  const [example, setExample] = useState(() =>
    createHitofudePuzzleExampleBoard(definition),
  );
  // 1回のなぞりで指が何マスも移ると、描き直しを待たずに続けて手を受ける。次の手を今の姿へ当てるため、姿を同時に持つ。
  const exampleRef = useRef(example);
  // 手の番号。道を変えたか弾かれた手のたびに進め、効果音と盤面の反応に、別の手として渡す。
  const moveIdRef = useRef(0);
  const [moveId, setMoveId] = useState(0);
  // 本番のプレイと同じく、阻まれた手は、次に阻まれるまで盤面に渡し続け、×と揺れを途中で消さない。
  // 例には待った・盤面を戻すが無く、元に戻すときは面が例を作り直すので、ほかに消す時は無い。
  const [blockedMove, setBlockedMove] =
    useState<HitofudePuzzleBlockedMove | null>(null);
  // 最初から完成した姿の例（ルールの例）は、本番の完成した盤面の見た目で静止させ、クリア演出を返さない。
  const [clearAnimationDone, setClearAnimationDone] = useState(
    () => getHitofudePuzzleExampleStatus(example).solved,
  );
  const reportChange = useReportHowToPlayExampleChange();
  const { isDeadEnd, solved } = getHitofudePuzzleExampleStatus(example);
  const clearing = solved && !clearAnimationDone;
  const progress: GameProgress = !solved
    ? "playing"
    : clearing
      ? "clearing"
      : "result";

  useHitofudePuzzleSoundEffects(
    toPathNotice(example, moveId),
    progress,
    getHitofudePuzzleExamplePath(example).length,
  );

  /** 次の姿にする。本番と同じく、道を変えたか弾かれた手だけを、盤面の反応と効果音に渡す新しい手にする。 */
  function apply(next: HitofudePuzzleExampleBoard): void {
    const move = next.lastMove;
    const moved = move !== exampleRef.current.lastMove;
    exampleRef.current = next;
    setExample(next);
    if (!moved) {
      return;
    }
    moveIdRef.current += 1;
    const id = moveIdRef.current;
    setMoveId(id);
    if (move?.change === "blocked") {
      setBlockedMove({ id, direction: move.direction, cell: move.cell });
    }
    reportChange(isHitofudePuzzleExampleChanged(next));
  }

  const completeClearAnimation = useCallback(() => {
    setClearAnimationDone(true);
  }, []);

  // ×は短く点いて消えるので、点いている間だけ、そのマスを渡す。消えた手の番号を覚え、時間が来たら渡すのをやめる。
  const [expiredBlockedMoveId, setExpiredBlockedMoveId] = useState<
    number | null
  >(null);
  useEffect(() => {
    if (blockedMove === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setExpiredBlockedMoveId(blockedMove.id),
      BLOCKED_MARK_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [blockedMove]);
  // 直前の手が弾かれた手なら、盤面に渡している阻まれた手はその手で、まだ道を変えていない。
  const blockedMarkCell =
    example.lastMove?.change === "blocked" &&
    blockedMove !== null &&
    blockedMove.id !== expiredBlockedMoveId
      ? blockedMove.cell
      : null;

  return {
    example,
    isDeadEnd,
    solved,
    clearing,
    blockedMove,
    blockedMarkCell,
    beginStroke(cell) {
      apply(pressHitofudePuzzleExampleCell(exampleRef.current, cell));
    },
    traceStroke(step) {
      apply(traceHitofudePuzzleExample(exampleRef.current, step));
    },
    endStroke() {
      apply(releaseHitofudePuzzleExample(exampleRef.current));
    },
    completeClearAnimation,
  };
}
