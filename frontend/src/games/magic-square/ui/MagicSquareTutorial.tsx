import { useCallback, useEffect, useRef, useState } from "react";

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
import type { MagicSquareLine } from "@/games/magic-square/puzzle/board";
import { listMagicSquareValueStates } from "@/games/magic-square/puzzle/rules";
import {
  describeMagicSquareTutorialSelection,
  findMagicSquareTutorialDecidingLine,
  findMagicSquareTutorialHint,
  findMagicSquareTutorialWrongCellIndex,
  getMagicSquareTutorialProgressRatio,
  listMagicSquareTutorialLineEvaluations,
  MAGIC_SQUARE_TUTORIAL_PROGRESS_STEP_COUNT,
  type MagicSquareTutorialAction,
  type MagicSquareTutorialBoardState,
  type MagicSquareTutorialHint,
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

/** 決め手の列で数を入れた後、その列がそろったのを見せてから、次の印と一言に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 効果音のフックへ渡す、本番のプレイの進み方。解き終えたら本番と同じクリア演出とクリア音にする。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function ignoreClearAnimation(): void {}

/** 手順を終えた手が決め手の列で決まったなら、その列を見せる間を置く。 */
function holdsFinishedStep(progress: MagicSquareTutorialProgress): boolean {
  const { lastMove } = progress.boardState;
  return (
    progress.phase === "playing" &&
    lastMove !== null &&
    lastMove.fitsStep &&
    lastMove.decidingLine !== null
  );
}

function getHintLines(
  hint: MagicSquareTutorialHint | null,
): readonly MagicSquareLine[] {
  return hint?.kind === "line" ? [hint.line] : [];
}

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
  const [heldProgress, setHeldProgress] =
    useState<MagicSquareTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<MagicSquareTutorialProgress | null>(null);
  // `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
  const [operation, setOperation] = useState<MagicSquareOperation | null>(null);
  const nextOperationIdRef = useRef(0);
  const situation = getTutorialSituation(magicSquareTutorial, progress);
  const { step } = situation;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const recallId = recall?.progress === progress ? recall.id : null;
  // 手順を終えた手の決め手の列を見せている間は、一言も終えた手順のままにし、次の印と一緒に替える。
  const holding = holdsFinishedStep(progress) && heldProgress !== progress;
  const heldStep = holding
    ? (magicSquareTutorial.steps[progress.stepIndex - 1] ?? null)
    : null;
  const wrongCellIndex =
    playing && progress.violated
      ? findMagicSquareTutorialWrongCellIndex(boardState)
      : null;
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは求められたときだけ見せる。
  const hintRequestable =
    playing && step === null && !holding && wrongCellIndex === null;
  const hint =
    hintRequestable && hintRequestedProgress === progress
      ? findMagicSquareTutorialHint(situation, boardState)
      : null;
  const cellCue = getCellCue();
  const valueCue: MagicSquareValueCue | null =
    playing &&
    !holding &&
    step?.kind === "operation" &&
    boardState.selectedCellIndex === step.cellIndex
      ? { value: step.value, recallId }
      : null;
  const spotlightLines = playing ? getSpotlightLines() : [];

  useMagicSquareSoundEffects(operation, gameProgressByPhase[progress.phase]);

  useEffect(() => {
    if (!open || !holdsFinishedStep(progress)) {
      return;
    }
    const timer = window.setTimeout(
      () => setHeldProgress(progress),
      NEXT_STEP_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress]);

  function getCellCue(): MagicSquareCellCue | null {
    if (!playing || holding) {
      return null;
    }
    // 違う数を入れたマスは、選び直して直すまで印を付ける。
    if (wrongCellIndex !== null) {
      return boardState.selectedCellIndex === wrongCellIndex
        ? null
        : { cellIndex: wrongCellIndex, recallId, pointer: false };
    }
    if (hint !== null) {
      return { cellIndex: hint.cellIndex, recallId: null, pointer: false };
    }
    if (
      step === null ||
      step.kind === "search" ||
      boardState.selectedCellIndex === step.cellIndex
    ) {
      return null;
    }
    // 列で決まる手順では、指がマスの周りの数を隠すので、輪郭だけにする。
    return {
      cellIndex: step.cellIndex,
      recallId,
      pointer: step.kind === "operation",
    };
  }

  function getSpotlightLines(): readonly MagicSquareLine[] {
    const { lastMove, selectedCellIndex } = boardState;
    if (holding) {
      return lastMove?.decidingLine ? [lastMove.decidingLine] : [];
    }
    if (step === null) {
      return getHintLines(hint);
    }
    if (step.kind === "line") {
      return [step.line];
    }
    // 探す手順では、空いたマスが1つの列のマスを選んだら、その列を見せる。
    if (step.kind === "search" && selectedCellIndex !== null) {
      const line = findMagicSquareTutorialDecidingLine(
        boardState.puzzleState,
        situation.earnedRuleIds,
        selectedCellIndex,
      );
      return line ? [line] : [];
    }
    return [];
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function perform(action: MagicSquareTutorialAction): void {
    if (!playing) {
      return;
    }
    const next = performTutorialAction(magicSquareTutorial, progress, action);
    // 手を引いている間に印の無い所を押されたら、盤面は変えず、印の線を短く濃くして目を向けさせる。
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
    setHeldProgress(null);
    setHintRequestedProgress(null);
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

  const message =
    heldStep?.message ??
    hint?.message ??
    (progress.violated
      ? null
      : describeMagicSquareTutorialSelection(situation, boardState)) ??
    getTutorialMessage(magicSquareTutorial, progress, {
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
      : boardState;
    return (
      <div className="flex h-[100cqh] w-[100cqw] max-w-xl flex-col gap-3 pb-3">
        <div className="min-h-0 flex-1">
          <TutorialCrossFadeIntroScene
            scene={scene}
            playing={scenePlaying}
            onSceneEnd={onSceneEnd}
          >
            {(showsGoal) => {
              const shown = showsGoal ? goalBoardState : boardState;
              return (
                <MagicSquareBoard
                  givens={givens}
                  board={shown.puzzleState}
                  lineEvaluations={listMagicSquareTutorialLineEvaluations(
                    situation,
                    shown,
                  )}
                  selectedCellIndex={shown.selectedCellIndex}
                  interactionDisabled={!solving}
                  clearing={!showsGoal && progress.phase === "solved"}
                  cue={showsGoal || scene !== null ? null : cellCue}
                  spotlightLines={
                    showsGoal || scene !== null ? [] : spotlightLines
                  }
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
          cue={scene === null ? valueCue : null}
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
      spotlighting={spotlightLines.length > 0}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getMagicSquareTutorialProgressRatio(boardState)
      }
      progressStepCount={MAGIC_SQUARE_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={() => setProgress(finishTutorialIntro)}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <MagicSquareHowToPlayDialog {...control} />
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
