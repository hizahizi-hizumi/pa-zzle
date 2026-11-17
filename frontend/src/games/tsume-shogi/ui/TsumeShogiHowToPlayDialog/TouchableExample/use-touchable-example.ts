import { useCallback, useEffect, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import { useHowToPlayExampleSelection } from "@/components/how-to-play-example-selection";
import type { GameProgress } from "@/games/play";
import type {
  TsumeShogiOperation,
  TsumeShogiOperationType,
} from "@/games/tsume-shogi/play/tsume-shogi-operation";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { findTsumeShogiDefenderKing } from "@/games/tsume-shogi/puzzle/position";
import {
  createTsumeShogiExampleBoard,
  hasTsumeShogiExampleChanged,
  performTsumeShogiExampleAction,
  replyTsumeShogiExampleDefender,
  type TsumeShogiExampleAction,
  type TsumeShogiExampleBoard,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import type { TsumeShogiHowToPlayExample } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { useTsumeShogiSoundEffects } from "@/games/tsume-shogi/ui/use-tsume-shogi-sound-effects";

type TsumeShogiTouchableExample = {
  board: TsumeShogiExampleBoard;
  /** 本番のプレイ画面と同じ進み方。詰ませると詰みの演出の間 `clearing`、演出を終えると `result` にする。 */
  progress: GameProgress;
  perform: (action: TsumeShogiExampleAction) => void;
  completeClearAnimation: () => void;
};

/**
 * 触れる例の状態。本番のプレイフックと同じく、攻方の手の後は間を置いて玉方の応手を盤面に指し、詰ませたら詰みの演出を見せる。
 * 音は本番と同じフックで、本番と同じ操作の知らせから鳴らす。詰ませた例では、本番と同じ詰みの音を鳴らす。
 * `example` から例を作るのは最初の描画のときだけで、変わっても例を作り直さない。
 * 押すたびに、指した手が最初の姿と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function useTouchableExample(
  example: TsumeShogiHowToPlayExample,
): TsumeShogiTouchableExample {
  const [board, setBoard] = useState(() =>
    createTsumeShogiExampleBoard(example),
  );
  const [operation, setOperation] = useState<TsumeShogiOperation | null>(null);
  const [clearSettled, setClearSettled] = useState(false);
  const operationIdRef = useRef(0);
  const boardRef = useRef(board);
  boardRef.current = board;
  const reportChange = useReportHowToPlayExampleChange();
  const { session } = board;
  const progress: GameProgress =
    session.status !== "cleared"
      ? "playing"
      : clearSettled
        ? "result"
        : "clearing";

  useTsumeShogiSoundEffects(
    operation,
    progress,
    findTsumeShogiDefenderKing(session.puzzleState),
  );

  function announce(type: TsumeShogiOperationType | null) {
    if (type === null) {
      return;
    }
    operationIdRef.current += 1;
    setOperation({ id: operationIdRef.current, type });
  }

  // 本番と同じく、攻方が指してから間を置いて、玉方の応手を盤面に指す。応手を待つ間は盤面を押しても変わらない。
  const turnAwaitingReply = session.defenderReplyPending
    ? session.turns.at(-1)
    : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 応手を待つ手が変わったときだけ、間を置き直す
  useEffect(() => {
    if (!turnAwaitingReply) {
      return;
    }
    const timer = window.setTimeout(() => {
      const replied = replyTsumeShogiExampleDefender(boardRef.current);
      setBoard(replied.board);
      announce(replied.operation);
    }, TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [turnAwaitingReply]);

  function perform(action: TsumeShogiExampleAction) {
    const performed = performTsumeShogiExampleAction(board, action);
    if (performed.board === board) {
      return;
    }
    setBoard(performed.board);
    announce(performed.operation);
    reportChange(hasTsumeShogiExampleChanged(performed.board, example));
  }

  // 本番のプレイ画面と同じく、駒を選んでいる間と成るかの選択肢を出している間の Esc は、遊び方を閉じずにそれを解く。
  // 最初から駒を選んで見せる例は、触れる前の選びを図の一部として扱い、触れる前の Esc では遊び方を閉じる。
  useHowToPlayExampleSelection(
    (session.selection !== null || session.promotionChoice !== null) &&
      hasTsumeShogiExampleChanged(board, example),
    () => perform({ type: "cancel" }),
  );

  // 詰みの演出は、受け取る関数が替わると始め直すので、同じ関数を渡し続ける。
  const completeClearAnimation = useCallback(() => setClearSettled(true), []);

  return { board, progress, perform, completeClearAnimation };
}
