import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import {
  findNanpureTutorialHint,
  findNanpureTutorialWrongCellIndex,
  getNanpureTutorialCompletedDigits,
  getNanpureTutorialConflictCellIndices,
  getNanpureTutorialStepCellIndex,
  isNanpureTutorialCellSelectable,
  NANPURE_TUTORIAL_GIVENS,
  type NanpureTutorialBoardState,
  type NanpureTutorialRuleId,
  nanpureTutorial,
} from "@/games/nanpure/tutorial/tutorial";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import {
  type NanpureTutorialCellCue,
  NanpureTutorialCues,
  type NanpureTutorialUnitCue,
} from "@/games/nanpure/ui/NanpureTutorial/NanpureTutorialCues";
import { NanpureTutorialRewind } from "@/games/nanpure/ui/NanpureTutorial/NanpureTutorialRewind";
import { NanpureDigitPad } from "@/games/nanpure/ui/play/NanpureDigitPad";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type NanpureTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type NanpureTutorialProgress = TutorialProgress<
  NanpureTutorialRuleId,
  NanpureTutorialBoardState
>;

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

function createUnitCues(
  kind: NanpureTutorialUnitCue["kind"],
  units: readonly NanpureTutorialUnitCue["unit"][],
  id: number,
): NanpureTutorialUnitCue[] {
  return units.map((unit) => ({ unit, kind, id }));
}

/**
 * 直前の手への合図。手順のマスに解の数字を入れたらそのマスを光らせ、
 * 入れた数字が盤面だけで決まっていたら、決め手の行・列・ブロックを光らせる。
 */
function getMoveCues({ lastMove, moveCount }: NanpureTutorialBoardState): {
  unitCues: NanpureTutorialUnitCue[];
  cellCues: NanpureTutorialCellCue[];
} {
  if (!lastMove || lastMove.violated) {
    return { unitCues: [], cellCues: [] };
  }
  return {
    unitCues: createUnitCues("reason", lastMove.reasonUnits, moveCount),
    cellCues: lastMove.fitsStep
      ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
      : [],
  };
}

/**
 * 本物の 9×9 の盤面の空いた12マスを、一言と印に沿って1マスずつ一緒に埋め、行・列・ブロックのルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で埋めさせる。盤面・数字のボタン・解けたときの演出は本番と同じ部品を使う。
 */
export function NanpureTutorial({
  open,
  onStartPlay,
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
  // 手を引いている間に印の無いマスを押されたら、押したマスを縁取り、印を光らせて付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const [rejectedCellIndex, setRejectedCellIndex] = useState<number | null>(
    null,
  );
  const situation = getTutorialSituation(nanpureTutorial, progress);
  const { step } = situation;
  const guiding = step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const idleHintShown = playing && !guiding && idleProgress === progress;
  // 正しい手が、前に入れた違う数字と重なったときは、直す数字のマスにすぐ印を付ける。
  const wrongCellIndex =
    playing && progress.violated && !boardState.lastMove?.violated
      ? findNanpureTutorialWrongCellIndex(situation, boardState)
      : null;
  const idleHint =
    wrongCellIndex !== null
      ? { cellIndex: wrongCellIndex, reasonUnits: [] }
      : idleHintShown
        ? findNanpureTutorialHint(situation, boardState)
        : null;
  const selectedIsEditable =
    selectedCellIndex !== null &&
    NANPURE_TUTORIAL_GIVENS[selectedCellIndex] === null;

  useEffect(() => {
    if (!open || progress.phase !== "playing" || guiding) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, guiding]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function handleSelectCell(cellIndex: number): void {
    if (!playing) {
      return;
    }
    if (!isNanpureTutorialCellSelectable(situation, cellIndex)) {
      setRejectedCellIndex(cellIndex);
      setHintCueId((id) => id + 1);
      return;
    }
    setRejectedCellIndex(null);
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
    if (next === progress) {
      return;
    }
    setRejectedCellIndex(null);
    setProgress(next);
    // 手順を終えたら選択を外し、次の印のマスへ目を向けさせる。解けたら、完成した盤面だけを見せる。
    if (next.stepIndex !== progress.stepIndex || next.phase !== "playing") {
      setSelectedCellIndex(null);
    }
  }

  function restart(): void {
    setIdleProgress(null);
    setRejectedCellIndex(null);
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
    onStartPlay?.();
  }

  /**
   * 始めの盤面の場面では、解き終えた盤面から入れた数字を消していき、消し終えたら始めの盤面に替える。
   * 最初の手順の印と決め手は、導入の終わりに一言と同時に出す。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && scenePlaying);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    const stepMarksShown =
      step !== null && (playing || (scene === null && messageShown));
    const stepCellIndex = stepMarksShown
      ? getNanpureTutorialStepCellIndex(situation, boardState)
      : null;
    const hintCellIndex = stepMarksShown
      ? stepCellIndex
      : (idleHint?.cellIndex ?? null);
    const clueUnits = stepMarksShown
      ? (step?.reasonUnits ?? [])
      : (idleHint?.reasonUnits ?? []);
    const moveCues = getMoveCues(boardState);
    const unitCues = goalShown
      ? []
      : [
          ...moveCues.unitCues,
          ...createUnitCues("clue", clueUnits, progress.stepIndex),
        ];
    const cellCues: NanpureTutorialCellCue[] = goalShown
      ? []
      : [
          ...moveCues.cellCues,
          ...(hintCellIndex === null
            ? []
            : [
                {
                  cellIndex: hintCellIndex,
                  kind: "hint" as const,
                  id: hintCueId,
                },
              ]),
          ...(rejectedCellIndex === null
            ? []
            : [
                {
                  cellIndex: rejectedCellIndex,
                  kind: "rejected" as const,
                  id: hintCueId,
                },
              ]),
        ];
    const cuedDigit =
      stepMarksShown && selectedCellIndex === step?.cellIndex
        ? step.cuedDigit
        : null;

    return (
      <div className="flex w-[min(100cqw,calc(100cqh-4rem),28rem)] flex-col gap-2">
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
            <div className="relative">
              <NanpureBoard
                board={shownBoardState.board}
                clues={NANPURE_TUTORIAL_GIVENS}
                notes={noNotes}
                selectedCellIndex={goalShown ? null : selectedCellIndex}
                conflictCellIndices={getNanpureTutorialConflictCellIndices(
                  situation,
                  shownBoardState,
                )}
                mistakeCellIndices={[]}
                interactionDisabled={!playing}
                sizeClassName="w-full"
                onSelectCell={handleSelectCell}
              />
              <NanpureTutorialCues unitCues={unitCues} cellCues={cellCues} />
            </div>
          </NanpureTutorialRewind>
        </NanpureClearAnimation>
        <NanpureDigitPad
          notesMode={false}
          canEnterDigit={playing && selectedIsEditable}
          completedDigits={getNanpureTutorialCompletedDigits(boardState)}
          cuedDigit={cuedDigit}
          onInputDigit={handleInputDigit}
        />
      </div>
    );
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={NANPURE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={nanpureTutorial.intro}
      rules={nanpureTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(nanpureTutorial, progress, {
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
