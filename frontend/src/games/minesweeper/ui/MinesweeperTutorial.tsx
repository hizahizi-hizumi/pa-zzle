import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  createMinesweeperFlagOperation,
  createMinesweeperOpeningOperation,
  type MinesweeperOperation,
} from "@/games/minesweeper/play/use-minesweeper-play";
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
  type MinesweeperTutorialStep,
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
import {
  MinesweeperTutorialStatus,
  type MinesweeperTutorialToggleCue,
} from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus";
import { useMinesweeperSoundEffects } from "@/games/minesweeper/ui/use-minesweeper-sound-effects";
import type { GameProgress } from "@/games/play";
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
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
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

/**
 * 手を引いている間に印の無いマスを押されたときや、手順と違う操作をされたときの、印の押し直し。印の線を短く濃くして戻す。
 * - `id`: 押されるたびに増やし、続けて押されても押し直す。
 * - `progress`: 押されたときの進行。手が進んだら押し直しを終える。
 */
type MinesweeperTutorialRecall = {
  id: number;
  progress: MinesweeperTutorialProgress;
};

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

/** 本番の効果音のフックへ渡す、プレイの進行。解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<MinesweeperTutorialProgress["phase"], GameProgress>;

/**
 * 盤面を変えた手を、本番と同じ操作の知らせにする。数字を押してまとめて開く手は、本番と同じく開く手として鳴らす。
 * `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
 */
function createOperation(
  action: MinesweeperTutorialAction,
  previous: MinesweeperTutorialBoardState,
  next: MinesweeperTutorialBoardState,
  id: number,
): MinesweeperOperation {
  return action.type === "flag"
    ? createMinesweeperFlagOperation(id, action.cellIndex, next.puzzle)
    : createMinesweeperOpeningOperation(
        id,
        action.cellIndex,
        previous.puzzle,
        next.puzzle,
      );
}

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
 * マスに重ねる印と応え。
 * - 手順の印のマスを手順どおりにしたら、そのマスに応える。
 * - 次に操作するマスに印を付け、押し直すとき（`recallId`）だけ印の線を濃くする。
 */
function getCellCues(
  { lastMove, moveCount }: MinesweeperTutorialBoardState,
  hintCellIndices: readonly number[],
  recallId: number | null,
): MinesweeperCellCue[] {
  return [
    ...(lastMove?.fittedCellIndices ?? []).map(
      (cellIndex): MinesweeperCellCue => ({
        cellIndex,
        kind: "fitted",
        id: moveCount,
      }),
    ),
    ...hintCellIndices.map(
      (cellIndex): MinesweeperCellCue =>
        recallId === null
          ? { cellIndex, kind: "hint", id: 0 }
          : { cellIndex, kind: "recall", id: recallId },
    ),
  ];
}

/**
 * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せるマス。
 * 次に操作する印のマスと、それを決めるマス（決め手）に加えて、直前に手順どおりにしたマスも抜き、その手への応えを見せる。
 */
function getSpotlitCellIndices(
  step: MinesweeperTutorialStep,
  state: MinesweeperTutorialBoardState,
  stepCellIndices: readonly number[],
): number[] {
  return [
    ...stepCellIndices,
    ...step.reasonCellIndices,
    ...(state.lastMove?.fittedCellIndices ?? []),
  ];
}

/**
 * 5×5 の盤面を、一言と印に沿って一緒に解き、数字と地雷の総数の決まりを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で開かせる。盤面・旗の切り替え・解けたときの演出は本番と同じ部品を使う。
 */
export function MinesweeperTutorial({
  open,
  playStart,
  onClose,
}: MinesweeperTutorialProps) {
  const [progress, setProgress] = useState<MinesweeperTutorialProgress>(() =>
    startTutorial(minesweeperTutorial),
  );
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  // 本番の効果音のフックへ渡す、盤面を変えた手の知らせ。
  const [operation, setOperation] = useState<MinesweeperOperation | null>(null);
  const nextOperationIdRef = useRef(1);
  const [idleProgress, setIdleProgress] =
    useState<MinesweeperTutorialProgress | null>(null);
  const [recall, setRecall] = useState<MinesweeperTutorialRecall | null>(null);
  const situation = getTutorialSituation(minesweeperTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const recallId = recall?.progress === progress ? recall.id : null;
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
    entry: playStart ? "home" : "play",
    violationSettled: true,
  });
  const message =
    step !== null && modeMismatched && tutorialMessage === step.message
      ? {
          ...step.message,
          detail: minesweeperTutorialModeSwitchDetails[step.operation],
        }
      : tutorialMessage;

  useMinesweeperSoundEffects(operation, gameProgressByPhase[progress.phase]);

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

  /** 印の無いマスを押されたり、手順と違う操作をされたりしたら、赤は使わず、印の線を短く濃くして目を向けさせる。 */
  function recallHint(): void {
    setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
  }

  /** 手を引いている間に、印のとおりでない操作を受けたら、印へ目を向けさせる。 */
  function handleIgnoredAction(): void {
    if (guiding && progress.phase === "playing") {
      recallHint();
    }
  }

  function perform(action: MinesweeperTutorialAction): void {
    const next = performTutorialAction(minesweeperTutorial, progress, action);
    if (next === progress) {
      handleIgnoredAction();
      return;
    }
    setProgress(next);
    setOperation(
      createOperation(
        action,
        progress.boardState,
        next.boardState,
        nextOperationIdRef.current++,
      ),
    );
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
    setRecall(null);
    setOperation(null);
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
    playStart?.onStart();
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
    // 完成の演出と完成した盤面には、最後の手の応えを残さない。
    const cuesShown =
      !goalShown &&
      (progress.phase === "intro" || progress.phase === "playing");
    const stepSpotlit = step !== null && progress.phase === "playing";
    const toggleCue: MinesweeperTutorialToggleCue | null =
      stepMarksShown && modeMismatched
        ? { recallId }
        : idleHintNeedsSwitch
          ? { recallId: null }
          : null;
    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.25rem),28rem)] flex-col gap-2">
        <MinesweeperTutorialStatus
          mineCount={MINESWEEPER_TUTORIAL_MINE_COUNT}
          flagCount={shownBoardState.puzzle.flaggedCellIndices.length}
          mineCountSpotlit={stepSpotlit && step.reasonMineCount}
          mode={mode}
          toggleCue={toggleCue}
          toggleSpotlit={stepSpotlit && modeMismatched}
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
            {/*
              ゴールの盤面と解いている盤面は別の盤面として描き直す。同じマスのまま開いた面から閉じた面へ替えると、
              マスの色の移り変わりで、閉じた面を重ねた覆いを外した瞬間に開いた面の白が透けて見える。
            */}
            <MinesweeperBoard
              key={goalShown ? "goal" : "play"}
              rows={MINESWEEPER_TUTORIAL_ROWS}
              columns={MINESWEEPER_TUTORIAL_COLUMNS}
              cells={getMinesweeperTutorialVisibleCells(shownBoardState)}
              mode={mode}
              interactionDisabled={progress.phase !== "playing"}
              cues={
                cuesShown
                  ? getCellCues(boardState, hintCellIndices, recallId)
                  : []
              }
              spotlitCellIndices={
                stepSpotlit
                  ? getSpotlitCellIndices(step, boardState, stepCellIndices)
                  : []
              }
              onRevealCell={handleRevealCell}
              onToggleFlag={handleToggleFlag}
              onChordCell={handleChordCell}
              onIneffectiveCellPress={handleIgnoredAction}
            />
          </MinesweeperTutorialCover>
        </MinesweeperClearAnimation>
      </div>
    );
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
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
      phase={progress.phase}
      guiding={progress.phase === "playing" && guiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
