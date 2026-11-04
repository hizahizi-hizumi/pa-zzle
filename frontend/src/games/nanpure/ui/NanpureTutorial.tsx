import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  createNanpureDigitOperation,
  type NanpureOperation,
} from "@/games/nanpure/play/use-nanpure-play";
import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import {
  findNanpureTutorialHintCellIndex,
  findNanpureTutorialWrongCellIndex,
  getNanpureTutorialCompletedDigits,
  getNanpureTutorialConflictCellIndices,
  getNanpureTutorialMistakeCellIndices,
  getNanpureTutorialStepCellIndex,
  getNanpureTutorialUnitCellIndices,
  isNanpureTutorialCellSelectable,
  NANPURE_TUTORIAL_GIVENS,
  type NanpureTutorialBoardState,
  type NanpureTutorialRuleId,
  type NanpureTutorialSituation,
  nanpureTutorial,
} from "@/games/nanpure/tutorial/tutorial";
import type { NanpureBoardSpotlight } from "@/games/nanpure/ui/board/board-spotlight";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
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
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type NanpureTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type NanpureTutorialProgress = TutorialProgress<
  NanpureTutorialRuleId,
  NanpureTutorialBoardState
>;

/**
 * 手を引いている間に印の無いマスを押されたときの、印の押し直し。印の線を短く濃くして戻す。
 * - `id`: 押されるたびに増やし、続けて押されても押し直す。
 * - `progress`: 押されたときの進行。手が進んだら押し直しを終える。
 */
type NanpureTutorialRecall = {
  id: number;
  progress: NanpureTutorialProgress;
};

/** 手順どおりに入れてから次の印を付けるまでの間。入れたマスと決め手を残して見せてから、次の印とその決め手に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/**
 * 手を離した後、手が止まってから決まるマスを示すまでの間。
 * 行・列・ブロックを見比べて考えている間は先回りしないよう、長めに待つ。
 */
const IDLE_HINT_DELAY_MS = 10_000;

/** チュートリアルではメモを使わないので、どのマスにもメモは無い。 */
const noNotes: NanpureNotes = Array.from(
  { length: NANPURE_TUTORIAL_GIVENS.length },
  () => [],
);

const goalBoardState = nanpureTutorial.goal();

/** 本番の効果音のフックへ渡す、プレイの進行。解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、手順を終えた手に決め手があれば、それを見せてから付ける。
 * 手を離した後は、手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: NanpureTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  const { lastMove } = progress.boardState;
  return lastMove?.fitsStep && lastMove.reasonUnits.length > 0
    ? NEXT_STEP_CUE_DELAY_MS
    : 0;
}

/** 直前の手への合図。手順のマスに解の数字を入れた応え。 */
function getMoveCues({
  lastMove,
  moveCount,
}: NanpureTutorialBoardState): NanpureCellCue[] {
  return lastMove?.fitsStep
    ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
    : [];
}

/** 次に数字を入れるマスの印。印の無いマスを押されたら（`recallId`）、印の線を短く濃くして戻す。 */
function getHintCue(
  cellIndex: number,
  recallId: number | null,
): NanpureCellCue {
  return recallId === null
    ? { cellIndex, kind: "hint", id: 0 }
    : { cellIndex, kind: "recall", id: recallId };
}

/**
 * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せる所。
 * - 印が出ている間は、印のマスとその決め手の行・列・ブロック。
 * - 入れてから次の印を出すまでの間は、入れたマスとその決め手。前の手の決め手を、次の印の決め手と読み違えさせないため、印と一緒に替える。
 * - 重なりを示しているマスは、何と重なったかを読めるよう抜く。
 * 抜く行・列・ブロックに含まれるマスは、まとまりの形で抜けるので、マスとしては重ねて抜かない。
 */
function getBoardSpotlight(
  situation: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  cueShown: boolean,
): NanpureBoardSpotlight {
  const { step } = situation;
  const { lastMove } = state;
  const focus =
    cueShown && step !== null
      ? { cellIndices: [step.cellIndex], units: step.reasonUnits }
      : {
          cellIndices: lastMove ? [lastMove.cellIndex] : [],
          units: lastMove?.reasonUnits ?? [],
        };
  const unitCellIndices = new Set(
    focus.units.flatMap(getNanpureTutorialUnitCellIndices),
  );
  return {
    cellIndices: [
      ...focus.cellIndices,
      ...getNanpureTutorialConflictCellIndices(situation, state),
    ].filter((cellIndex) => !unitCellIndices.has(cellIndex)),
    units: focus.units,
  };
}

/**
 * 本物の 9×9 の盤面の空いた12マスを、一言と印に沿って1マスずつ一緒に埋め、行・列・ブロックのルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で埋めさせる。盤面・数字のボタン・ミスと重なりの色・解けたときの演出は本番と同じ部品を使う。
 */
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
  const [idleProgress, setIdleProgress] =
    useState<NanpureTutorialProgress | null>(null);
  // 本番の効果音のフックへ渡す、盤面を変えた手の知らせ。
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
    step !== null && selectedCellIndex === step.cellIndex;
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
  const freePlayHintCellIndex =
    wrongCellIndex ??
    (playing && !guiding && cueShown
      ? findNanpureTutorialHintCellIndex(situation, boardState)
      : null);
  // 手順を終えた手の決め手を残して見せる間は、一言とルールの並びも終えた手順のままにし、次の印と一緒に替える。
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
    if (!isNanpureTutorialCellSelectable(situation, cellIndex)) {
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
    setRecall(null);
    setOperation(null);
    setSelectedCellIndex(null);
    setProgress(startTutorial(nanpureTutorial));
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
   * 始めの盤面の場面では、解き終えた盤面から入れた数字を消していき、消し終えたら始めの盤面に替える。
   * 最初の手順の印は、導入の終わりに一言と同時に出す。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && scenePlaying);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    const stepMarkShown = playing
      ? guiding && cueShown
      : step !== null && scene === null && messageShown;
    const stepCellIndex = stepMarkShown
      ? getNanpureTutorialStepCellIndex(situation, boardState)
      : null;
    const hintCellIndex = stepCellIndex ?? freePlayHintCellIndex;
    // 完成の演出と完成した盤面に、最後の手の合図を残さない。
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
    const spotlit = playing && guiding;
    // マスを選んだ後は、次に押すのは数字のボタンなので、押させたい数字か、押せる数字をすべて覆いから抜く。
    const stepDigit = step?.cuedDigit ?? null;
    const spotlitDigits =
      spotlit && cueShown && stepCellSelected
        ? stepDigit !== null
          ? [stepDigit]
          : NANPURE_DIGITS.filter((digit) => !completedDigits.includes(digit))
        : [];
    const cuedDigit = stepMarkShown && stepCellSelected ? stepDigit : null;

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
              spotlight={
                spotlit
                  ? getBoardSpotlight(situation, boardState, cueShown)
                  : null
              }
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
          spotlitDigits={spotlitDigits}
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
      open={open}
      title={NANPURE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={nanpureTutorial.intro}
      rules={nanpureTutorial.rules.map((rule) => ({
        ...rule,
        earned:
          progress.earnedRuleIds.includes(rule.id) &&
          !(heldStep !== null && step?.introducedRuleId === rule.id),
        current: (heldStep ?? step)?.introducedRuleId === rule.id,
      }))}
      message={
        heldStep?.message ??
        getTutorialMessage(nanpureTutorial, progress, {
          entry: finish.entry,
          violationSettled: true,
        })
      }
      phase={progress.phase}
      guiding={playing && guiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
