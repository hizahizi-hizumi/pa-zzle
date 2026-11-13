import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  createNanpureDigitOperation,
  type NanpureOperation,
} from "@/games/nanpure/play/use-nanpure-play";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import {
  describeNanpureTutorialMistake,
  describeNanpureTutorialStep,
  findNanpureTutorialHint,
  findNanpureTutorialWrongCellIndex,
  getNanpureTutorialCompletedDigits,
  getNanpureTutorialConflictCellIndices,
  getNanpureTutorialCuedDigit,
  getNanpureTutorialMistakeCellIndices,
  getNanpureTutorialProgressRatio,
  getNanpureTutorialStepCellIndex,
  getNanpureTutorialStepFocus,
  getNanpureTutorialUnitCellIndices,
  isNanpureTutorialCellSelectable,
  NANPURE_TUTORIAL_GIVENS,
  NANPURE_TUTORIAL_PROGRESS_STEP_COUNT,
  type NanpureTutorialBoardState,
  type NanpureTutorialFocus,
  type NanpureTutorialHint,
  type NanpureTutorialRuleId,
  nanpureTutorial,
} from "@/games/nanpure/tutorial/tutorial";
import type { NanpureBoardSpotlight } from "@/games/nanpure/ui/board/board-spotlight";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { NanpureGround } from "@/games/nanpure/ui/NanpureGround";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureTutorialRewind } from "@/games/nanpure/ui/NanpureTutorial/NanpureTutorialRewind";
import { NanpureDigitPad } from "@/games/nanpure/ui/play/NanpureDigitPad";
import { useNanpureSoundEffects } from "@/games/nanpure/ui/use-nanpure-sound-effects";
import type { GameProgress } from "@/games/play";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type NanpureTutorialProps = {
  open: boolean;
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type NanpureTutorialProgress = TutorialProgress<
  NanpureTutorialRuleId,
  NanpureTutorialBoardState
>;

/**
 * 手を引いている間に印の無いマスを押されたときの、印の押し直し。
 * `id` は押されるたびに増やし、続けて押されても押し直す。
 */
type NanpureTutorialRecall = {
  id: number;
  progress: NanpureTutorialProgress;
};

/** 入れたマスと決め手を残して見せてから、次の印とその決め手に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** チュートリアルではメモを使わないので、どのマスにもメモは無い。 */
const noNotes: NanpureNotes = Array.from(
  { length: NANPURE_TUTORIAL_GIVENS.length },
  () => [],
);

const goalBoardState = nanpureTutorial.goal();

/** 解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/** 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。 */
function getCueDelayMs(
  progress: NanpureTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return null;
  }
  const { lastMove } = progress.boardState;
  return lastMove?.fitsStep && lastMove.reasonUnits.length > 0
    ? NEXT_STEP_CUE_DELAY_MS
    : 0;
}

function getMoveCues({
  lastMove,
  moveCount,
}: NanpureTutorialBoardState): NanpureCellCue[] {
  return lastMove?.fitsStep
    ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
    : [];
}

function getHintCue(
  cellIndex: number,
  recallId: number | null,
): NanpureCellCue {
  return recallId === null
    ? { cellIndex, kind: "hint", id: 0 }
    : { cellIndex, kind: "recall", id: recallId };
}

const noFocus: NanpureTutorialFocus = { cellIndices: [], units: [] };

function getHintFocus(hint: NanpureTutorialHint | null): NanpureTutorialFocus {
  switch (hint?.kind) {
    case undefined:
    case "wrong-digit":
      return noFocus;
    case "last-empty":
      return { cellIndices: [], units: [hint.unit] };
    case "placement":
      return {
        cellIndices: hint.placement.eliminatingCellIndices,
        units: [hint.placement.block],
      };
  }
}

function getHintCellIndex(hint: NanpureTutorialHint | null): number | null {
  return hint?.kind === "wrong-digit" || hint?.kind === "last-empty"
    ? hint.cellIndex
    : null;
}

function getHintMessage(
  hint: NanpureTutorialHint | null,
): TutorialMessage | null {
  return hint === null || hint.kind === "wrong-digit" ? null : hint.message;
}

/**
 * 重なりを示しているマスは、何と重なったかを読めるよう抜く。
 * 抜く行・列・ブロックに含まれるマスは、まとまりの形で抜けるので、マスとしては重ねて抜かない。
 */
function getBoardSpotlight(
  focus: NanpureTutorialFocus,
  conflictCellIndices: readonly number[],
): NanpureBoardSpotlight | null {
  if (focus.units.length === 0 && conflictCellIndices.length === 0) {
    return null;
  }
  const unitCellIndices = new Set(
    focus.units.flatMap(getNanpureTutorialUnitCellIndices),
  );
  return {
    cellIndices: [...focus.cellIndices, ...conflictCellIndices].filter(
      (cellIndex) => !unitCellIndices.has(cellIndex),
    ),
    units: focus.units,
  };
}

export function NanpureTutorial({
  open,
  playStart,
  onClose,
}: NanpureTutorialProps) {
  const [progress, setProgress] = useState<NanpureTutorialProgress>(() =>
    startTutorial(nanpureTutorial),
  );
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
    null,
  );
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<NanpureTutorialProgress | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<NanpureTutorialProgress | null>(null);
  // `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
  const [operation, setOperation] = useState<NanpureOperation | null>(null);
  const nextOperationIdRef = useRef(1);
  const [recall, setRecall] = useState<NanpureTutorialRecall | null>(null);
  const situation = getTutorialSituation(nanpureTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const recallId = recall?.progress === progress ? recall.id : null;
  const stepCellSelected =
    guiding &&
    selectedCellIndex !== null &&
    isNanpureTutorialCellSelectable(situation, boardState, selectedCellIndex);
  const cueDelayMs = getCueDelayMs(progress, guiding);
  // 印の無いマスを押されたときと、印を待たずに手順のマスを選んだときは、すぐ印を付ける。
  const cueShown =
    cueDelayMs === 0 ||
    (cueDelayMs !== null && idleProgress === progress) ||
    (playing && guiding && (recallId !== null || stepCellSelected));
  // 正しい手が、前に入れた違う数字と重なったときは、直す数字のマスにすぐ印を付ける。
  const wrongCellIndex =
    playing && progress.violated && !boardState.lastMove?.violated
      ? findNanpureTutorialWrongCellIndex(situation, boardState)
      : null;
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは求められたときだけ見せる。
  const hintRequestable = wrongCellIndex === null && playing && !guiding;
  const idleHint =
    hintRequestable && hintRequestedProgress === progress
      ? findNanpureTutorialHint(situation, boardState)
      : null;
  const freePlayHintCellIndex = wrongCellIndex ?? getHintCellIndex(idleHint);
  const boardSpotlight = playing
    ? getBoardSpotlight(
        getShownFocus(),
        getNanpureTutorialConflictCellIndices(situation, boardState),
      )
    : null;

  // 入れてから次の印を出すまでの間は、入れたマスとその決め手を見せる。前の手の決め手を、次の印の決め手と読み違えさせないため、印と一緒に替える。
  function getShownFocus(): NanpureTutorialFocus {
    if (!guiding) {
      return getHintFocus(idleHint);
    }
    const { lastMove } = boardState;
    return cueShown
      ? (getNanpureTutorialStepFocus(situation, boardState) ?? noFocus)
      : {
          cellIndices: lastMove ? [lastMove.cellIndex] : [],
          units: lastMove?.reasonUnits ?? [],
        };
  }
  // 手順を終えた手の決め手を残して見せる間は、一言も終えた手順のままにし、次の印と一緒に替える。
  const heldStep =
    playing && guiding && !cueShown
      ? (nanpureTutorial.steps[progress.stepIndex - 1] ?? null)
      : null;
  const selectedIsEditable =
    selectedCellIndex !== null &&
    NANPURE_TUTORIAL_GIVENS[selectedCellIndex] === null;
  const completedDigits = getNanpureTutorialCompletedDigits(boardState);

  useNanpureSoundEffects(operation, gameProgressByPhase[progress.phase]);

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

  function recallCue(): void {
    setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
  }

  function handleSelectCell(cellIndex: number): void {
    if (!playing) {
      return;
    }
    // 印の無いマスを押されたら、赤は使わず、印の線を短く濃くして目を向けさせる。
    if (!isNanpureTutorialCellSelectable(situation, boardState, cellIndex)) {
      recallCue();
      return;
    }
    setRecall(null);
    setSelectedCellIndex(cellIndex);
  }

  function handleInputDigit(digit: NanpureDigit): void {
    if (selectedCellIndex === null) {
      return;
    }
    const next = performTutorialAction(nanpureTutorial, progress, {
      cellIndex: selectedCellIndex,
      digit,
    });
    // 手を引いている間に印の無い数字を押されたら、盤面は変えず、印の線を短く濃くして目を向けさせる。
    if (next === progress) {
      if (guiding) {
        recallCue();
      }
      return;
    }
    setProgress(next);
    // 本番と同じく、解と違う数字にはミスの音を鳴らす。チュートリアルはミスを数えない。
    setOperation(
      createNanpureDigitOperation(
        nextOperationIdRef.current++,
        getNanpureTutorialMistakeCellIndices(next.boardState).includes(
          selectedCellIndex,
        ),
      ),
    );
    // 手順を終えたら選択を外し、次の印のマスへ目を向けさせる。解けたら、完成した盤面だけを見せる。
    if (next.stepIndex !== progress.stepIndex || next.phase !== "playing") {
      setSelectedCellIndex(null);
    }
  }

  function restart(): void {
    setIdleProgress(null);
    setHintRequestedProgress(null);
    setRecall(null);
    setOperation(null);
    setSelectedCellIndex(null);
    setProgress(startTutorial(nanpureTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    setProgress(finishTutorialIntro);
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき入口から始まるようにする。
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
    // 始めの盤面の場面では、解き終えた盤面から入れた数字を消していき、消し終えたら始めの盤面に替える。
    const goalShown = scene === "goal" || (scene === "start" && scenePlaying);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    // 最初の手順の印は、導入の終わりに一言と同時に出す。
    const stepMarkShown = playing
      ? guiding && cueShown
      : step !== null && scene === null;
    const stepCellIndex = stepMarkShown
      ? getNanpureTutorialStepCellIndex(situation, boardState)
      : null;
    const hintCellIndex = stepCellIndex ?? freePlayHintCellIndex;
    // 完成の演出と完成した盤面に、最後の手の合図を残さない。
    // マスの印には指を添えない。指が、決め手になる隣の数字を隠すため。
    const cellCues: NanpureCellCue[] = playing
      ? [
          ...getMoveCues(boardState),
          ...(hintCellIndex === null
            ? []
            : [getHintCue(hintCellIndex, recallId)]),
        ]
      : stepCellIndex === null
        ? []
        : [{ cellIndex: stepCellIndex, kind: "hint", id: 0 }];
    const cuedDigit = stepMarkShown
      ? getNanpureTutorialCuedDigit(situation, selectedCellIndex)
      : null;

    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.25rem),28rem)] flex-col gap-2">
        <NanpureClearAnimation
          active={
            progress.phase === "solved" || (scene === "goal" && scenePlaying)
          }
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <NanpureTutorialRewind
            active={scene === "start" && scenePlaying}
            onComplete={onSceneEnd}
          >
            <NanpureBoard
              board={shownBoardState.board}
              clues={NANPURE_TUTORIAL_GIVENS}
              notes={noNotes}
              selectedCellIndex={goalShown ? null : selectedCellIndex}
              conflictCellIndices={getNanpureTutorialConflictCellIndices(
                situation,
                shownBoardState,
              )}
              mistakeCellIndices={getNanpureTutorialMistakeCellIndices(
                shownBoardState,
              )}
              interactionDisabled={!playing}
              sizeClassName="w-full"
              cues={goalShown ? [] : cellCues}
              spotlight={goalShown ? null : boardSpotlight}
              onSelectCell={handleSelectCell}
            />
          </NanpureTutorialRewind>
        </NanpureClearAnimation>
        <NanpureDigitPad
          notesMode={false}
          canEnterDigit={playing && selectedIsEditable}
          completedDigits={completedDigits}
          cuedDigit={cuedDigit}
          cuedDigitRecallId={recallId}
          size="compact"
          onInputDigit={handleInputDigit}
        />
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
      title={NANPURE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<NanpureGround />}
      intro={nanpureTutorial.intro}
      recap={nanpureTutorial.rules.map((rule) => rule.label)}
      message={
        heldStep?.message ??
        (playing && !progress.violated
          ? describeNanpureTutorialMistake(boardState)
          : null) ??
        // 手がかりには、そのマスを決める見方の一言を添える。
        getHintMessage(idleHint) ??
        (progress.violated
          ? null
          : describeNanpureTutorialStep(
              situation,
              boardState,
              selectedCellIndex,
            )) ??
        getTutorialMessage(nanpureTutorial, progress, {
          entry: finish.entry,
          violationSettled: true,
        })
      }
      phase={progress.phase}
      spotlighting={boardSpotlight !== null}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getNanpureTutorialProgressRatio(boardState)
      }
      progressStepCount={NANPURE_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <NanpureHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && idleHint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
