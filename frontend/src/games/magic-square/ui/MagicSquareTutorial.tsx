import { useCallback, useRef, useState } from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/magic-square/assets/pictogram.svg?raw";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import type { MagicSquareOperation } from "@/games/magic-square/play/use-magic-square-play";
import {
  listMagicSquareLineEvaluations,
  listMagicSquareValueStates,
} from "@/games/magic-square/puzzle/rules";
import {
  type MagicSquareTutorialAction,
  type MagicSquareTutorialBoardState,
  type MagicSquareTutorialRuleId,
  magicSquareTutorial,
  magicSquareTutorialPuzzle,
} from "@/games/magic-square/tutorial/tutorial";
import {
  MagicSquareBoard,
  type MagicSquareCellCue,
} from "@/games/magic-square/ui/board/MagicSquareBoard";
import { MagicSquareGround } from "@/games/magic-square/ui/MagicSquareGround";
import { MagicSquareHowToPlayDialog } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog";
import {
  MagicSquareNumberPad,
  type MagicSquareValueCue,
} from "@/games/magic-square/ui/MagicSquareNumberPad";
import { useMagicSquareSoundEffects } from "@/games/magic-square/ui/use-magic-square-sound-effects";
import type { GameProgress } from "@/games/play";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type MagicSquareTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。渡さなければプレイ中のメニューから開いたとする。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type MagicSquareTutorialProgress = TutorialProgress<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialBoardState
>;

const { givens } = magicSquareTutorialPuzzle;
const goalBoardState = magicSquareTutorial.goal();
const recap = magicSquareTutorial.rules.map(({ label }) => label);
/** 手を引く手順と、手を離してから解き終えるまでの1段。 */
const progressStepCount = magicSquareTutorial.steps.length + 1;

/** 効果音のフックへ渡す、本番のプレイの進み方。解き終えたら本番と同じクリア演出とクリア音にする。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function ignoreClearAnimation(): void {}

export function MagicSquareTutorial({
  open,
  playStart,
  onClose,
}: MagicSquareTutorialProps) {
  const [progress, setProgress] = useState<MagicSquareTutorialProgress>(() =>
    startTutorial(magicSquareTutorial),
  );
  const [recall, setRecall] = useState<{
    progress: MagicSquareTutorialProgress;
    id: number;
  } | null>(null);
  // `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
  const [operation, setOperation] = useState<MagicSquareOperation | null>(null);
  const nextOperationIdRef = useRef(0);
  const { step } = getTutorialSituation(magicSquareTutorial, progress);
  const playing = progress.phase === "playing";
  const recallId = recall?.progress === progress ? recall.id : null;
  const cellCue: MagicSquareCellCue | null =
    playing && step?.kind === "select"
      ? { cellIndex: step.cellIndex, recallId }
      : null;
  const valueCue: MagicSquareValueCue | null =
    playing && step?.kind === "enter" ? { value: step.value, recallId } : null;

  useMagicSquareSoundEffects(operation, gameProgressByPhase[progress.phase]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function perform(action: MagicSquareTutorialAction): void {
    if (!playing) {
      return;
    }
    const next = performTutorialAction(magicSquareTutorial, progress, action);
    if (next === progress) {
      if (step !== null) {
        setRecall((current) => ({
          progress,
          id: current?.progress === progress ? current.id + 1 : 0,
        }));
      }
      return;
    }
    setProgress(next);
    const { selectedCellIndex } = progress.boardState;
    if (action.type === "enter" && selectedCellIndex !== null) {
      setOperation({
        id: nextOperationIdRef.current++,
        type:
          next.boardState.puzzleState.cells[selectedCellIndex] === action.value
            ? "placed"
            : "removed",
        cellIndex: selectedCellIndex,
        value: action.value,
      });
    }
  }

  function restart(): void {
    setRecall(null);
    setProgress(startTutorial(magicSquareTutorial));
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

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  const message = getTutorialMessage(magicSquareTutorial, progress, {
    entry: finish.entry,
    // 1回の操作で1つの数だけが変わり、途中で一瞬だけ違反になる手が無い。
    violationSettled: true,
  });

  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    const solving = playing && scene === null;
    const showsGoalOnly = scene === "goal";
    const { puzzleState, selectedCellIndex } = showsGoalOnly
      ? goalBoardState
      : progress.boardState;
    return (
      <div className="flex h-[100cqh] w-[100cqw] max-w-xl flex-col gap-3 pb-3">
        <div className="min-h-0 flex-1">
          <TutorialCrossFadeIntroScene
            scene={scene}
            playing={scenePlaying}
            onSceneEnd={onSceneEnd}
          >
            {(showsGoal) => {
              const shown = showsGoal ? goalBoardState : progress.boardState;
              return (
                <MagicSquareBoard
                  givens={givens}
                  board={shown.puzzleState}
                  lineEvaluations={listMagicSquareLineEvaluations(
                    shown.puzzleState,
                  )}
                  selectedCellIndex={shown.selectedCellIndex}
                  interactionDisabled={!solving}
                  clearing={!showsGoal && progress.phase === "solved"}
                  cue={showsGoal ? null : cellCue}
                  onSelectCell={(cellIndex) =>
                    perform({ type: "select", cellIndex })
                  }
                  onClearAnimationComplete={
                    showsGoal
                      ? ignoreClearAnimation
                      : handleClearAnimationComplete
                  }
                />
              );
            }}
          </TutorialCrossFadeIntroScene>
        </div>
        <MagicSquareNumberPad
          size={givens.size}
          valueStates={listMagicSquareValueStates(
            givens,
            puzzleState,
            selectedCellIndex,
          )}
          interactionDisabled={!solving}
          cue={valueCue}
          onEnterValue={(value) => perform({ type: "enter", value })}
        />
      </div>
    );
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={MAGIC_SQUARE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<MagicSquareGround />}
      intro={magicSquareTutorial.intro}
      recap={recap}
      message={message}
      phase={progress.phase}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : progress.stepIndex / progressStepCount
      }
      progressStepCount={progressStepCount}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={() => setProgress(finishTutorialIntro)}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <MagicSquareHowToPlayDialog {...control} />
      )}
      onClose={handleClose}
    />
  );
}
