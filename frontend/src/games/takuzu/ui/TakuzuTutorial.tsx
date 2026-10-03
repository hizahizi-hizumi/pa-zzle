import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { TutorialOverlay } from "@/components/TutorialOverlay";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  type TakuzuTutorialAction,
  type TakuzuTutorialRuleId,
  type TakuzuTutorialStageState,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import {
  advanceTutorialStage,
  getCurrentTutorialGuide,
  getCurrentTutorialStage,
  getTutorialMessage,
  isTutorialStageRule,
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
  TakuzuTutorialStageState
>;

/**
 * ルールに合わない手に、置いたタイルの揺れと違反の一言で応えるまでの間。
 * 空き→四角→丸と切り替える途中の四角が一瞬だけ違反になっても画面が揺れないよう、違反が続いたときだけ応える。
 * 盤面の違反の印の遅れ（240ms）より長く取り、ゆっくり続けて押す間隔（300〜400ms）でも出ず、手を止めればすぐ分かる長さにする。
 */
const VIOLATION_REACTION_DELAY_MS = 500;

/** 案内どおりの手を置いてから次の案内のマスを示すまでの間。決め手が光って消えるのを見届けてから示す。 */
const NEXT_GUIDE_HINT_DELAY_MS = 900;

/** 解けた盤面の波が終わってから次の盤面へ移るまでの、解けたときの一言を読む間。 */
const STAGE_SOLVED_PAUSE_MS = 700;

/** どのステージでもマスの大きさを揃え、盤面が 1×2 から 4×4 へ育って見えるようにする。 */
const largestLineLength = Math.max(
  ...takuzuTutorial.stages.map(({ givens }) =>
    Math.max(givens.shape.rowCount, givens.shape.columnCount),
  ),
);

/** 盤面の部品が、違反の印のために周りへ取る余白と枠の幅。 */
const boardFrameSize = "28px";

function getBoardFrameStyle(
  rowCount: number,
  columnCount: number,
): CSSProperties {
  const cellSize = `min(calc((100cqw - ${boardFrameSize}) / ${largestLineLength}), calc((100cqh - ${boardFrameSize}) / ${largestLineLength}), 6.5rem)`;
  return {
    width: `calc(${columnCount} * ${cellSize} + ${boardFrameSize})`,
    height: `calc(${rowCount} * ${cellSize} + ${boardFrameSize})`,
  };
}

/**
 * 決まるマスを示すまでの間。0 ならすぐ示し、`null` なら示さない。
 * 手を引いている間は、示したマスにしか置けないので、違反があっても示し続ける。
 * 行き詰まってルールを示した直後は、示したルールをどこで使うかをすぐ示す。
 * それ以外の手を離した後は手が止まったときだけ示し、違反がある間は直すことに向かわせるため示さない。
 */
function getHintDelayMs(
  progress: TakuzuTutorialProgress,
  idleHintDelayMs: number,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  const { lastMove } = progress.stageState;
  if (!guiding) {
    if (progress.violated || lastMove?.violated) {
      return null;
    }
    return lastMove?.revealedRuleId ? 0 : idleHintDelayMs;
  }
  const reasoned = (lastMove?.reasonCellIndices.length ?? 0) > 0;
  return reasoned ? NEXT_GUIDE_HINT_DELAY_MS : 0;
}

/**
 * 違反の揺れは、違反が続いたとき（`violationSettled`）だけ返す。
 * 示すマスの合図は `hintCueId` が変わったときだけやり直し、手を置くたびには示し直さない。
 */
function getCellCues(
  state: TakuzuTutorialStageState,
  violationSettled: boolean,
  hintCellIndex: number | null,
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
  return hintCellIndex === null
    ? moveCues
    : [...moveCues, { cellIndex: hintCellIndex, kind: "hint", id: hintCueId }];
}

/**
 * 1×2 から 4×4 へ育つ小さな盤面を順に解かせ、示したルールをすぐ使って「ここはこれしかない」と気づく手応えの中で身につけさせる。
 * 盤面・違反の印・解けたときの波は本番と同じ部品を使う。
 */
export function TakuzuTutorial({
  open,
  onStartPlay,
  onClose,
}: TakuzuTutorialProps) {
  const [progress, setProgress] = useState<TakuzuTutorialProgress>(() =>
    startTutorial(takuzuTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  // 手を引いている間に示していないマスを押されたら、示しているマスを示し直す。
  const [hintCueId, setHintCueId] = useState(0);
  const advanceTimerRef = useRef<number | null>(null);
  const violationTimerRef = useRef<number | null>(null);
  const stage = getCurrentTutorialStage(takuzuTutorial, progress);
  const guide = getCurrentTutorialGuide(takuzuTutorial, progress);
  const { stageState } = progress;
  const { rowCount, columnCount } = stageState.grid.shape;
  const violationSettled = settledViolationProgress === progress;
  const hintDelayMs = getHintDelayMs(
    progress,
    stage.idleHintDelayMs,
    guide !== null,
  );
  const hintShown =
    hintDelayMs === 0 || (hintDelayMs !== null && idleProgress === progress);
  const hintCellIndex = !hintShown
    ? null
    : guide !== null
      ? stageState.guidedCellIndex
      : findTakuzuTutorialHintCellIndex(
          stageState,
          stageState.lastMove?.revealedRuleId ?? null,
        );

  useEffect(() => {
    if (!open || hintDelayMs === null || hintDelayMs === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      hintDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, hintDelayMs]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
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
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setProgress((current) => advanceTutorialStage(takuzuTutorial, current));
    }, STAGE_SOLVED_PAUSE_MS);
  }, []);

  function perform(action: TakuzuTutorialAction): void {
    const next = performTutorialAction(takuzuTutorial, progress, action);
    if (next === progress) {
      if (guide !== null) {
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
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    cancelViolationReaction();
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setProgress(startTutorial(takuzuTutorial));
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    onStartPlay?.();
  }

  return (
    <TutorialOverlay
      open={open}
      gameTitle="バイナリパズル"
      rules={takuzuTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: isTutorialStageRule(stage, rule.id),
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
      {/* ステージごとに盤面を作り直し、次の盤面が現れる動きを付ける。 */}
      <div
        key={progress.stageIndex}
        className="animate-in fade-in-0 zoom-in-90 duration-300 ease-(--ease-enter) motion-reduce:animate-none"
        style={getBoardFrameStyle(rowCount, columnCount)}
      >
        <TakuzuClearAnimation
          active={progress.phase === "stage-solved"}
          onComplete={handleClearAnimationComplete}
        >
          <TakuzuBoard
            rowCount={rowCount}
            columnCount={columnCount}
            cells={getTakuzuTutorialCellViews(stage, stageState)}
            lineViolations={getTakuzuTutorialLineViolations(stageState)}
            disabled={progress.phase !== "playing"}
            cues={getCellCues(
              stageState,
              violationSettled,
              hintCellIndex,
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
