import { useCallback, useRef, useState } from "react";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  createMinesweeperFlagOperation,
  createMinesweeperOpeningOperation,
  type MinesweeperOperation,
} from "@/games/minesweeper/play/use-minesweeper-play";
import {
  describeMinesweeperTutorialHint,
  findMinesweeperTutorialHint,
  getMinesweeperTutorialProgressRatio,
  getMinesweeperTutorialStepCellIndices,
  getMinesweeperTutorialStepSpotlitCellIndices,
  getMinesweeperTutorialVisibleCells,
  MINESWEEPER_TUTORIAL_COLUMNS,
  MINESWEEPER_TUTORIAL_MINE_COUNT,
  MINESWEEPER_TUTORIAL_PROGRESS_STEP_COUNT,
  MINESWEEPER_TUTORIAL_RECAP,
  MINESWEEPER_TUTORIAL_ROWS,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialHint,
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
import { MinesweeperGround } from "@/games/minesweeper/ui/MinesweeperGround";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
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
  type TutorialMessage,
  type TutorialProgress,
} from "@/games/tutorial";

type MinesweeperTutorialProps = {
  open: boolean;
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type MinesweeperTutorialProgress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

type MinesweeperTutorialRecall = {
  id: number;
  progress: MinesweeperTutorialProgress;
};

const goalBoardState = minesweeperTutorial.goal();

const startRevealedCellIndices =
  minesweeperTutorial.start().puzzle.revealedCellIndices;

const startCoveredCellIndices = Array.from(
  { length: MINESWEEPER_TUTORIAL_ROWS * MINESWEEPER_TUTORIAL_COLUMNS },
  (_, cellIndex) => cellIndex,
).filter((cellIndex) => !startRevealedCellIndices.includes(cellIndex));

/** 解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<MinesweeperTutorialProgress["phase"], GameProgress>;

/** 数字を押してまとめて開く手は、本番と同じく開く手として鳴らす。 */
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

function getCellCues(
  { lastMove, moveCount }: MinesweeperTutorialBoardState,
  markedCellIndices: readonly number[],
  recallId: number | null,
  pointed: boolean,
): MinesweeperCellCue[] {
  return [
    ...(lastMove?.fittedCellIndices ?? []).map(
      (cellIndex): MinesweeperCellCue => ({
        cellIndex,
        kind: "fitted",
        id: moveCount,
      }),
    ),
    ...markedCellIndices.map(
      (cellIndex, order): MinesweeperCellCue => ({
        cellIndex,
        kind: recallId === null ? "hint" : "recall",
        id: recallId ?? 0,
        pointed: pointed && order === 0,
      }),
    ),
  ];
}

export function MinesweeperTutorial({
  open,
  playStart,
  onClose,
}: MinesweeperTutorialProps) {
  const [progress, setProgress] = useState<MinesweeperTutorialProgress>(() =>
    startTutorial(minesweeperTutorial),
  );
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const [operation, setOperation] = useState<MinesweeperOperation | null>(null);
  // `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
  const nextOperationIdRef = useRef(1);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<MinesweeperTutorialProgress | null>(null);
  const [recall, setRecall] = useState<MinesweeperTutorialRecall | null>(null);
  const [helpedStepIndex, setHelpedStepIndex] = useState<number | null>(null);
  const situation = getTutorialSituation(minesweeperTutorial, progress);
  const { step } = situation;
  const playing = progress.phase === "playing";
  const guiding = playing && step !== null;
  const recallId = recall?.progress === progress ? recall.id : null;
  const { boardState } = progress;
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは求められたときだけ見せる。
  const hintRequestable = playing && step === null;
  const hint: MinesweeperTutorialHint | null =
    hintRequestable && hintRequestedProgress === progress
      ? findMinesweeperTutorialHint(situation, boardState)
      : null;
  // 決め手を見せる手順では、押す所と操作を自分で選ばせるため、助けるまで印を付けない。
  const choosing = guiding && step.reasonCellIndices.length > 0;
  const stepMarked =
    guiding && (!choosing || helpedStepIndex === progress.stepIndex);
  const markedCellIndices = stepMarked
    ? getMinesweeperTutorialStepCellIndices(situation, boardState)
    : hint
      ? [hint.cellIndex]
      : [];
  const requiredMode: MinesweeperInputMode | null = stepMarked
    ? step.operation
    : (hint?.operation ?? null);
  const modeMismatched = requiredMode !== null && requiredMode !== mode;
  // 切り替えが要るときは、次に押す所は切り替えなので、指は切り替えを指す。
  const toggleCue: MinesweeperTutorialToggleCue | null = modeMismatched
    ? { recallId, pointed: true }
    : null;
  const spotlitCellIndices = getSpotlitCellIndices();
  const message = getMessage();

  useMinesweeperSoundEffects(operation, gameProgressByPhase[progress.phase]);

  /**
   * 盤面の覆いから抜いて元の明るさで見せるマス。見せる決め手が無ければ `null` で、覆わない。
   * - 手順の間は、決めた数字とその周りの8マス。直前に手順どおりにしたマスと踏んだ地雷も抜き、その手への盤面の反応を見せる。操作を教える手順には決め手が無いので覆わない。
   * - 手を離した後は、「ヒント」で示したマスとその決め手。
   */
  function getSpotlitCellIndices(): number[] | null {
    if (choosing) {
      const { lastMove } = boardState;
      return [
        ...getMinesweeperTutorialStepSpotlitCellIndices(step, boardState),
        ...markedCellIndices,
        ...(lastMove?.fittedCellIndices ?? []),
        ...(lastMove?.steppedMine ? [lastMove.cellIndex] : []),
      ];
    }
    return hint ? [hint.cellIndex, ...hint.reasonCellIndices] : null;
  }

  function getMessage(): TutorialMessage {
    const tutorialMessage = getTutorialMessage(minesweeperTutorial, progress, {
      entry: playStart ? "home" : "play",
      violationSettled: true,
    });
    if (hint) {
      return describeMinesweeperTutorialHint(boardState, hint);
    }
    // 印を付けた手順の操作に切り替えが合っていなければ、地雷を踏んだ後も含めて、補足で切り替えさせる。
    if (step !== null && stepMarked && modeMismatched) {
      return {
        ...tutorialMessage,
        detail: minesweeperTutorialModeSwitchDetails[step.operation],
      };
    }
    return tutorialMessage;
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function handleIgnoredAction(): void {
    if (guiding) {
      setHelpedStepIndex(progress.stepIndex);
      setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
    }
  }

  function perform(action: MinesweeperTutorialAction): void {
    const next = performTutorialAction(minesweeperTutorial, progress, action);
    if (next === progress) {
      handleIgnoredAction();
      return;
    }
    if (guiding && next.violated) {
      setHelpedStepIndex(progress.stepIndex);
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
    setHintRequestedProgress(null);
    setHelpedStepIndex(null);
    setRecall(null);
    setOperation(null);
    setMode("reveal");
    setProgress(startTutorial(minesweeperTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    setProgress(finishTutorialIntro);
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    // 始めの盤面の場面では、解き終えた盤面に開いていないマスを閉じていき、閉じ終えたら始めの盤面に替える。
    const goalShown = scene === "goal" || (scene === "start" && scenePlaying);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    // 完成の演出と完成した盤面には、最後の手の応えを残さない。
    const cuesShown = scene === null && playing;
    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.25rem),28rem)] flex-col gap-2">
        <MinesweeperTutorialStatus
          mineCount={MINESWEEPER_TUTORIAL_MINE_COUNT}
          flagCount={shownBoardState.puzzle.flaggedCellIndices.length}
          mode={mode}
          toggleCue={cuesShown ? toggleCue : null}
          onModeChange={setMode}
        />
        <MinesweeperClearAnimation
          active={
            progress.phase === "solved" || (scene === "goal" && scenePlaying)
          }
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <MinesweeperTutorialCover
            active={scene === "start" && scenePlaying}
            rows={MINESWEEPER_TUTORIAL_ROWS}
            columns={MINESWEEPER_TUTORIAL_COLUMNS}
            startCoveredCellIndices={startCoveredCellIndices}
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
              interactionDisabled={!playing}
              cues={
                cuesShown
                  ? getCellCues(
                      boardState,
                      markedCellIndices,
                      recallId,
                      !modeMismatched,
                    )
                  : []
              }
              spotlitCellIndices={cuesShown ? spotlitCellIndices : null}
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
      presentation="stage"
      open={open}
      title={MINESWEEPER_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<MinesweeperGround />}
      intro={minesweeperTutorial.intro}
      recap={MINESWEEPER_TUTORIAL_RECAP}
      message={message}
      phase={progress.phase}
      spotlighting={spotlitCellIndices !== null}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getMinesweeperTutorialProgressRatio(progress.stepIndex, boardState)
      }
      progressStepCount={MINESWEEPER_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <MinesweeperHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && hint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
