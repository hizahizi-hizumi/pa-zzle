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
  getCurrentTutorialStage,
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

/** 手が止まってから、決まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 7000;

/** 解けた盤面の波が終わってから次の盤面へ移るまでの、解けたときの一言を読む間。 */
const STAGE_SOLVED_PAUSE_MS = 700;

/** どのステージでもマスの大きさを揃え、盤面が 1×3 から 4×4 へ育って見えるようにする。 */
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

function getCellCues(
  state: TakuzuTutorialStageState,
  hintCellIndex: number | null,
): TakuzuCellCue[] {
  const { lastMove, moveCount } = state;
  const moveCues: TakuzuCellCue[] = !lastMove
    ? []
    : lastMove.violated
      ? [{ cellIndex: lastMove.cellIndex, kind: "rejected", id: moveCount }]
      : lastMove.reasonCellIndices.map((cellIndex) => ({
          cellIndex,
          kind: "reason",
          id: moveCount,
        }));
  return hintCellIndex === null
    ? moveCues
    : [...moveCues, { cellIndex: hintCellIndex, kind: "hint", id: moveCount }];
}

/**
 * 1×3 から 4×4 へ育つ小さな盤面を順に解かせ、「ここはこれしかない」と気づく手応えの中でルールを手に入れさせる。
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
  const advanceTimerRef = useRef<number | null>(null);
  const stage = getCurrentTutorialStage(takuzuTutorial, progress);
  const { stageState } = progress;
  const { rowCount, columnCount } = stageState.grid.shape;
  const hintCellIndex =
    idleProgress === progress
      ? findTakuzuTutorialHintCellIndex(stageState)
      : null;

  useEffect(() => {
    if (!open || progress.phase !== "playing") {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const handleClearAnimationComplete = useCallback(() => {
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setProgress((current) => advanceTutorialStage(takuzuTutorial, current));
    }, STAGE_SOLVED_PAUSE_MS);
  }, []);

  function perform(action: TakuzuTutorialAction): void {
    setProgress((current) =>
      performTutorialAction(takuzuTutorial, current, action),
    );
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
    setIdleProgress(null);
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
      }))}
      message={progress.message}
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
            cues={getCellCues(stageState, hintCellIndex)}
            onCycleCell={handleCycleCell}
            onPlaceCell={handlePlaceCell}
          />
        </TakuzuClearAnimation>
      </div>
    </TutorialOverlay>
  );
}
