import { useCallback, useEffect, useRef, useState } from "react";

import { TutorialOverlay } from "@/components/TutorialOverlay";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialStepCellIndices,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialRuleId,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import {
  completeTutorial,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type TakuzuTutorialProps = {
  open: boolean;
  /** 渡すと、終えたときにレベル1を始める操作を出す。渡さなければ、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type TakuzuTutorialProgress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

/**
 * ルールに合わない手に、置いたタイルの揺れと違反の一言で応えるまでの間。
 * 空き→四角→丸と切り替える途中の四角が一瞬だけ違反になっても画面が揺れないよう、違反が続いたときだけ応える。
 * 盤面の違反の印の遅れ（240ms）より長く取り、ゆっくり続けて押す間隔（300〜400ms）でも出ず、手を止めればすぐ分かる長さにする。
 */
const VIOLATION_REACTION_DELAY_MS = 500;

/** 手順どおりに置いてから次の印を付けるまでの間。決め手が光って消えるのを見届けてから示す。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、印のマスにしか置けないので、違反があっても付け続ける。
 * 手を離した後は手が止まったときだけ付け、違反がある間は直すことに向かわせるため付けない。
 */
function getCueDelayMs(
  progress: TakuzuTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  const { lastMove } = progress.boardState;
  if (!guiding) {
    return progress.violated || lastMove?.violated ? null : IDLE_HINT_DELAY_MS;
  }
  const reasoned = (lastMove?.reasonCellIndices.length ?? 0) > 0;
  return reasoned ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/**
 * 違反の揺れは、違反が続いたとき（`violationSettled`）だけ返す。
 * 印の合図は `hintCueId` が変わったときだけやり直し、手を置くたびには付け直さない。
 */
function getCellCues(
  state: TakuzuTutorialBoardState,
  violationSettled: boolean,
  hintCellIndices: readonly number[],
  hintCueId: number,
): TakuzuCellCue[] {
  const { lastMove, moveCount } = state;
  const moveCues: TakuzuCellCue[] = !lastMove
    ? []
    : lastMove.violated
      ? violationSettled
        ? [{ cellIndex: lastMove.cellIndex, kind: "rejected", id: moveCount }]
        : []
      : lastMove.reasonCellIndices.map((cellIndex) => ({
          cellIndex,
          kind: "reason",
          id: moveCount,
        }));
  return [
    ...moveCues,
    ...hintCellIndices.map(
      (cellIndex): TakuzuCellCue => ({
        cellIndex,
        kind: "hint",
        id: hintCueId,
      }),
    ),
  ];
}

/**
 * 4×4 の盤面を、一言と印に沿って1マスずつ一緒に埋め、ルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で埋めさせる。盤面・違反の印・解けたときの波は本番と同じ部品を使う。
 */
export function TakuzuTutorial({
  open,
  onStartPlay,
  onClose,
}: TakuzuTutorialProps) {
  const [progress, setProgress] = useState<TakuzuTutorialProgress>(() =>
    startTutorial(takuzuTutorial),
  );
  // もう一度始めるたびに盤面を作り直し、解けたときの波の状態も残さない。
  const [runId, setRunId] = useState(0);
  const [idleProgress, setIdleProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  // 手を引いている間に印の無いマスを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const violationTimerRef = useRef<number | null>(null);
  const situation = getTutorialSituation(takuzuTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const violationSettled = settledViolationProgress === progress;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 || (cueDelayMs !== null && idleProgress === progress);
  const idleHintCellIndex =
    cueShown && !guiding
      ? findTakuzuTutorialHintCellIndex(situation, boardState)
      : null;
  const hintCellIndices = !cueShown
    ? []
    : guiding
      ? getTakuzuTutorialStepCellIndices(situation, boardState)
      : idleHintCellIndex === null
        ? []
        : [idleHintCellIndex];

  useEffect(() => {
    if (!open || cueDelayMs === null || cueDelayMs === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      cueDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, cueDelayMs]);

  useEffect(() => {
    return () => {
      if (violationTimerRef.current !== null) {
        window.clearTimeout(violationTimerRef.current);
      }
    };
  }, []);

  function cancelViolationReaction(): void {
    if (violationTimerRef.current !== null) {
      window.clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
    }
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function perform(action: TakuzuTutorialAction): void {
    const next = performTutorialAction(takuzuTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setProgress(next);
    // 次の手が来たら、前の手の違反には応えない。
    cancelViolationReaction();
    if (next.violated) {
      violationTimerRef.current = window.setTimeout(() => {
        violationTimerRef.current = null;
        setSettledViolationProgress(next);
      }, VIOLATION_REACTION_DELAY_MS);
    }
  }

  function handleCycleCell(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
    perform({ type: "cycle", cellIndex, direction });
  }

  function handlePlaceCell(cellIndex: number, cell: TakuzuCell): void {
    perform({ type: "place", cellIndex, cell });
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function restart(): void {
    cancelViolationReaction();
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setProgress(startTutorial(takuzuTutorial));
    setRunId((id) => id + 1);
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    onStartPlay?.();
  }

  const { size } = boardState.board;
  return (
    <TutorialOverlay
      open={open}
      title="バイナリパズル"
      rules={takuzuTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(takuzuTutorial, progress, violationSettled)}
      completed={progress.phase === "completed"}
      finishAction={
        onStartPlay
          ? { label: "レベル1を遊ぶ", onSelect: handleStartPlay }
          : { label: "プレイに戻る", onSelect: handleClose }
      }
      onRestart={restart}
      onClose={handleClose}
    >
      <div
        key={runId}
        className="aspect-square w-[min(100cqw,100cqh,28rem)] animate-in fade-in-0 zoom-in-90 duration-300 ease-(--ease-enter) motion-reduce:animate-none"
      >
        <TakuzuClearAnimation
          active={progress.phase === "solved"}
          onComplete={handleClearAnimationComplete}
        >
          <TakuzuBoard
            rowCount={size}
            columnCount={size}
            cells={getTakuzuTutorialCellViews(situation, boardState)}
            lineViolations={getTakuzuTutorialLineViolations(
              situation,
              boardState,
            )}
            disabled={progress.phase !== "playing"}
            cues={getCellCues(
              boardState,
              violationSettled,
              hintCellIndices,
              hintCueId,
            )}
            onCycleCell={handleCycleCell}
            onPlaceCell={handlePlaceCell}
          />
        </TakuzuClearAnimation>
      </div>
    </TutorialOverlay>
  );
}
