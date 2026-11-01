import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  findMinesweeperTutorialHintCellIndex,
  getMinesweeperTutorialStepCellIndices,
  getMinesweeperTutorialVisibleCells,
  isMinesweeperTutorialCellFlagged,
  MINESWEEPER_TUTORIAL_COLUMNS,
  MINESWEEPER_TUTORIAL_MINE_COUNT,
  MINESWEEPER_TUTORIAL_ROWS,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialOperation,
  type MinesweeperTutorialRuleId,
  minesweeperTutorial,
  minesweeperTutorialModeSwitchDetails,
} from "@/games/minesweeper/tutorial/tutorial";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperTutorialCover } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialCover";
import { MinesweeperTutorialStatus } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type MinesweeperTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type MinesweeperTutorialProgress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

/**
 * 手を離した後、手が止まってから地雷でないと決まるマスを示すまでの間。
 * 数字を見比べて考えている間は先回りしないよう、ほかのチュートリアル（4秒）より長く待つ。
 */
const IDLE_HINT_DELAY_MS = 10_000;

const goalBoardState = minesweeperTutorial.goal();

const startRevealedCellIndices =
  minesweeperTutorial.start().puzzle.revealedCellIndices;

/** 始めの盤面で開いていないマス。導入で、解き終えた盤面からここを閉じて始めの盤面へ戻す。 */
const startCoveredCellIndices = Array.from(
  { length: MINESWEEPER_TUTORIAL_ROWS * MINESWEEPER_TUTORIAL_COLUMNS },
  (_, cellIndex) => cellIndex,
).filter((cellIndex) => !startRevealedCellIndices.includes(cellIndex));

/** 手順で印のマスにさせる操作と、それを受け付ける切り替え。 */
const stepOperationModes = {
  reveal: "reveal",
  flag: "flag",
} as const satisfies Record<MinesweeperTutorialOperation, MinesweeperInputMode>;

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、印のマスしか受け付けないので付け続ける。手を離した後は、手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: MinesweeperTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  return guiding ? 0 : IDLE_HINT_DELAY_MS;
}

/**
 * 直前の手への合図。手順の印のマスを手順どおりにしたらそのマスを光らせる。
 * 手を引いている間は決め手を手順の始まりから示しているので、手を離した後だけ、決め手の数字を光らせる。
 */
function getMoveCues({
  lastMove,
  moveCount,
}: MinesweeperTutorialBoardState): MinesweeperCellCue[] {
  if (!lastMove) {
    return [];
  }
  if (lastMove.fittedCellIndices.length > 0) {
    return createCues("fitted", lastMove.fittedCellIndices, moveCount);
  }
  return lastMove.reasonCellIndices.map(
    (cellIndex): MinesweeperCellCue => ({
      cellIndex,
      kind: "reason",
      id: moveCount,
    }),
  );
}

function createCues(
  kind: MinesweeperCellCue["kind"],
  cellIndices: readonly number[],
  id: number,
): MinesweeperCellCue[] {
  return cellIndices.map((cellIndex) => ({ cellIndex, kind, id }));
}

/**
 * 5×5 の盤面を、一言と印に沿って一緒に解き、数字と地雷の総数の決まりを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で開かせる。盤面・旗の切り替え・解けたときの演出は本番と同じ部品を使う。
 */
export function MinesweeperTutorial({
  open,
  onStartPlay,
  onClose,
}: MinesweeperTutorialProps) {
  const [progress, setProgress] = useState<MinesweeperTutorialProgress>(() =>
    startTutorial(minesweeperTutorial),
  );
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const [idleProgress, setIdleProgress] =
    useState<MinesweeperTutorialProgress | null>(null);
  // 手を引いている間に、印の無いマスや手順と違う操作を受けたら、押したマスを縁取り、印を光らせて付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const [rejectedCellIndex, setRejectedCellIndex] = useState<number | null>(
    null,
  );
  const situation = getTutorialSituation(minesweeperTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const { boardState } = progress;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 || (cueDelayMs !== null && idleProgress === progress);
  const idleHintCellIndex =
    cueShown && !guiding
      ? findMinesweeperTutorialHintCellIndex(situation, boardState)
      : null;
  const stepCellIndices = getMinesweeperTutorialStepCellIndices(
    situation,
    boardState,
  );
  // 手順の操作に切り替えが合っていない。一言の補足と切り替えの印で、切り替えさせる。
  const modeMismatched =
    step !== null && stepOperationModes[step.operation] !== mode;
  // 手がかりの印のマスを今の切り替えで押しても進めないときは、切り替えにも印を付ける。
  // 旗のマスは旗にして押すと旗を外せ、旗の無いマスは開くにして押すと開ける。
  const idleHintMode: MinesweeperInputMode | null =
    idleHintCellIndex === null
      ? null
      : isMinesweeperTutorialCellFlagged(boardState, idleHintCellIndex)
        ? "flag"
        : "reveal";
  const idleHintNeedsSwitch = idleHintMode !== null && idleHintMode !== mode;
  const tutorialMessage = getTutorialMessage(minesweeperTutorial, progress, {
    entry: onStartPlay ? "selection" : "play",
    violationSettled: true,
  });
  const message =
    step !== null && modeMismatched && tutorialMessage === step.message
      ? {
          ...step.message,
          detail: minesweeperTutorialModeSwitchDetails[step.operation],
        }
      : tutorialMessage;

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

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(action: MinesweeperTutorialAction): void {
    const next = performTutorialAction(minesweeperTutorial, progress, action);
    if (next === progress) {
      if (guiding && progress.phase === "playing") {
        setRejectedCellIndex(action.cellIndex);
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setRejectedCellIndex(null);
    setProgress(next);
  }

  function handleRevealCell(cellIndex: number): void {
    perform({ type: "reveal", cellIndex });
  }

  function handleToggleFlag(cellIndex: number): void {
    perform({ type: "flag", cellIndex });
  }

  function handleChordCell(cellIndex: number): void {
    perform({ type: "chord", cellIndex });
  }

  function restart(): void {
    setIdleProgress(null);
    setRejectedCellIndex(null);
    setMode("reveal");
    setProgress(startTutorial(minesweeperTutorial));
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    onStartPlay?.();
  }

  /**
   * 始めの盤面の場面では、解き終えた盤面に開いていないマスを閉じていき、閉じ終えたら始めの盤面に替える。
   * 最初の手順の印は、導入の終わりに一言と同時に出す。
   */
  function renderBoard({
    scene,
    playing,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && playing);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    // 最初の手順の印と決め手は、導入の終わりに一言と同時に出す。
    const stepMarksShown =
      step !== null &&
      (progress.phase === "playing" || (scene === null && messageShown));
    const hintCellIndices = stepMarksShown
      ? stepCellIndices
      : idleHintCellIndex === null
        ? []
        : [idleHintCellIndex];
    const cues = goalShown
      ? []
      : [
          ...getMoveCues(boardState),
          ...createCues(
            "clue",
            stepMarksShown ? (step?.reasonCellIndices ?? []) : [],
            0,
          ),
          ...createCues("hint", hintCellIndices, hintCueId),
          ...createCues(
            "rejected",
            rejectedCellIndex === null ? [] : [rejectedCellIndex],
            hintCueId,
          ),
        ];
    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.25rem),28rem)] flex-col gap-2">
        <MinesweeperTutorialStatus
          mineCount={MINESWEEPER_TUTORIAL_MINE_COUNT}
          flagCount={shownBoardState.puzzle.flaggedCellIndices.length}
          mineCountCued={stepMarksShown && step?.reasonMineCount === true}
          mode={mode}
          toggleCueId={
            (stepMarksShown && modeMismatched) || idleHintNeedsSwitch
              ? hintCueId
              : null
          }
          onModeChange={setMode}
        />
        <MinesweeperClearAnimation
          active={progress.phase === "solved" || (scene === "goal" && playing)}
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <MinesweeperTutorialCover
            active={scene === "start" && playing}
            rows={MINESWEEPER_TUTORIAL_ROWS}
            columns={MINESWEEPER_TUTORIAL_COLUMNS}
            coveredCellIndices={startCoveredCellIndices}
            onComplete={onSceneEnd}
          >
            <MinesweeperBoard
              rows={MINESWEEPER_TUTORIAL_ROWS}
              columns={MINESWEEPER_TUTORIAL_COLUMNS}
              cells={getMinesweeperTutorialVisibleCells(shownBoardState)}
              mode={mode}
              interactionDisabled={progress.phase !== "playing"}
              cues={cues}
              onRevealCell={handleRevealCell}
              onToggleFlag={handleToggleFlag}
              onChordCell={handleChordCell}
            />
          </MinesweeperTutorialCover>
        </MinesweeperClearAnimation>
      </div>
    );
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={MINESWEEPER_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={minesweeperTutorial.intro}
      rules={minesweeperTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: step?.introducedRuleId === rule.id,
      }))}
      message={message}
      introducing={progress.phase === "intro"}
      completed={progress.phase === "completed"}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
