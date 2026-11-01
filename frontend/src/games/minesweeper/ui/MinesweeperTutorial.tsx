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
  MINESWEEPER_TUTORIAL_COLUMNS,
  MINESWEEPER_TUTORIAL_MINE_COUNT,
  MINESWEEPER_TUTORIAL_ROWS,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialOperation,
  type MinesweeperTutorialRuleId,
  minesweeperTutorial,
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

/** 手順どおりに操作してから次の印を付けるまでの間。決め手の数字が光って消えるのを見届けてから示す。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 手を離した後、手が止まってから地雷でないと決まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

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
 * 手を引いている間は、印のマスしか受け付けないので付け続け、決め手が光ったときはそれを見届けてから付ける。
 * 手を離した後は、手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: MinesweeperTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  const reasoned =
    (progress.boardState.lastMove?.reasonCellIndices.length ?? 0) > 0;
  return reasoned ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/** 直前の手への合図。手順の印のマスを手順どおりにした合図と、決め手の数字の光。 */
function getMoveCues({
  lastMove,
  moveCount,
}: MinesweeperTutorialBoardState): MinesweeperCellCue[] {
  if (!lastMove) {
    return [];
  }
  const fittedCues: MinesweeperCellCue[] = lastMove.fitsStep
    ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
    : [];
  return [
    ...fittedCues,
    ...lastMove.reasonCellIndices.map(
      (cellIndex): MinesweeperCellCue => ({
        cellIndex,
        kind: "reason",
        id: moveCount,
      }),
    ),
  ];
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
  // 手を引いている間に印の無いマスや手順と違う操作を受けたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
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
  const hintCellIndices = !cueShown
    ? []
    : guiding
      ? getMinesweeperTutorialStepCellIndices(situation, boardState)
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

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(action: MinesweeperTutorialAction): void {
    const next = performTutorialAction(minesweeperTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
      }
      return;
    }
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
    const marksShown =
      progress.phase === "playing" || (scene === null && messageShown);
    const shownHintCellIndices = marksShown
      ? progress.phase === "playing"
        ? hintCellIndices
        : getMinesweeperTutorialStepCellIndices(situation, boardState)
      : [];
    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.25rem),28rem)] flex-col gap-2">
        <MinesweeperTutorialStatus
          mineCount={MINESWEEPER_TUTORIAL_MINE_COUNT}
          flagCount={shownBoardState.puzzle.flaggedCellIndices.length}
          mode={mode}
          toggleCueId={
            step !== null &&
            shownHintCellIndices.length > 0 &&
            stepOperationModes[step.operation] !== mode
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
              cues={
                goalShown
                  ? []
                  : [
                      ...getMoveCues(boardState),
                      ...shownHintCellIndices.map(
                        (cellIndex): MinesweeperCellCue => ({
                          cellIndex,
                          kind: "hint",
                          id: hintCueId,
                        }),
                      ),
                    ]
              }
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
      message={getTutorialMessage(minesweeperTutorial, progress, {
        entry: finish.entry,
        violationSettled: true,
      })}
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
