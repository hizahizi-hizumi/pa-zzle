import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleBoard as SlidePuzzleBoardState } from "@/games/slide-puzzle/puzzle/state";
import {
  describeSlidePuzzleTutorialOffStepTap,
  findSlidePuzzleTutorialHintTile,
  getSlidePuzzleTutorialStepTile,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  slidePuzzleTutorial,
} from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { SlidePuzzleTutorialScramble } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial/SlidePuzzleTutorialScramble";
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

type SlidePuzzleTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type SlidePuzzleTutorialProgress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

/** スライドしたタイルが収まるのを見届けてから、次の印を付けるまでの間。 */
const NEXT_STEP_CUE_DELAY_MS = 450;

/** 手を離した後、手が止まってから次にスライドさせるタイルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoard = slidePuzzleTutorial.goal().board;

/** 手の結果を、盤面のスライドか揺れの動きにする。 */
function createOperation(
  before: SlidePuzzleBoardState,
  next: SlidePuzzleTutorialProgress,
): SlidePuzzleOperation | null {
  const { lastMove, moveCount, board } = next.boardState;
  switch (lastMove?.type) {
    case "rejected":
      return { id: moveCount, type: "invalid", tileIndex: lastMove.cellIndex };
    case "slid":
      return {
        id: moveCount,
        type: "slid",
        slide: lastMove.slide,
        boardBefore: before,
        boardAfter: board,
        isClearingMove: next.phase === "solved",
      };
    case undefined:
      return null;
  }
}

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、スライドが収まってから印を付ける。手を離した後は手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: SlidePuzzleTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  return progress.boardState.lastMove ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/** 印の合図は `hintCueId` が変わったときだけやり直し、スライドのたびには付け直さない。 */
function getTileCues(
  state: SlidePuzzleTutorialBoardState,
  hintTile: number | null,
  hintCueId: number,
): SlidePuzzleTileCue[] {
  const { lastMove, moveCount } = state;
  const landedCues: SlidePuzzleTileCue[] =
    lastMove?.type === "slid"
      ? lastMove.landedTiles.map((tile) => ({
          tile,
          kind: "landed",
          id: moveCount,
        }))
      : [];
  return hintTile === null
    ? landedCues
    : [
        // 印を付けるタイルには、印だけを重ねる。
        ...landedCues.filter((cue) => cue.tile !== hintTile),
        { tile: hintTile, kind: "hint", id: hintCueId },
      ];
}

/**
 * 3×3 の盤面を、一言と印に沿って1枚ずつスライドさせ、ルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で並べさせる。盤面・スライドの動き・完成の波は本番と同じ部品を使う。
 */
export function SlidePuzzleTutorial({
  open,
  onStartPlay,
  onClose,
}: SlidePuzzleTutorialProps) {
  const [progress, setProgress] = useState<SlidePuzzleTutorialProgress>(() =>
    startTutorial(slidePuzzleTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面がスライドや揺れで応える。
  const [operation, setOperation] = useState<SlidePuzzleOperation | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  // 手を引いている間に印の無いタイルを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  // 手を引いている間に、印の無いタイルをタップしたときの一言。進行が変わるまで出す。
  const [offStepAnswer, setOffStepAnswer] = useState<{
    progress: SlidePuzzleTutorialProgress;
    message: TutorialMessage;
  } | null>(null);
  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 || (cueDelayMs !== null && idleProgress === progress);
  const hintTile = !cueShown
    ? null
    : guiding
      ? getSlidePuzzleTutorialStepTile(situation)
      : findSlidePuzzleTutorialHintTile(boardState);

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

  function handleSlideTile(cellIndex: number): void {
    const next = performTutorialAction(slidePuzzleTutorial, progress, {
      cellIndex,
    });
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
        const answer = describeSlidePuzzleTutorialOffStepTap(
          situation,
          boardState,
          cellIndex,
        );
        setOffStepAnswer(answer && { progress, message: answer });
      }
      return;
    }
    setProgress(next);
    setOperation(createOperation(progress.boardState.board, next));
  }

  function restart(): void {
    setIdleProgress(null);
    setOffStepAnswer(null);
    setOperation(null);
    setProgress(startTutorial(slidePuzzleTutorial));
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

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面では、ゴールから1枚ずつ崩していく。 */
  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
    return (
      <div className="aspect-square w-[min(100cqw,100cqh,28rem)]">
        <SlidePuzzleTutorialScramble
          active={scene === "start" && playing}
          onComplete={onSceneEnd}
        >
          {(frame) => (
            <SlidePuzzleBoard
              board={
                frame?.board ??
                (scene === "goal" ? goalBoard : boardState.board)
              }
              operation={
                frame ? frame.operation : scene === null ? operation : null
              }
              interactionDisabled={progress.phase !== "playing"}
              clearing={
                progress.phase === "solved" || (scene === "goal" && playing)
              }
              cues={
                // 完成の波を、収まった合図と重ねずに見せる。
                progress.phase === "playing"
                  ? getTileCues(boardState, hintTile, hintCueId)
                  : []
              }
              onSlideTile={handleSlideTile}
              onClearAnimationComplete={
                scene === "goal" ? onSceneEnd : handleClearAnimationComplete
              }
            />
          )}
        </SlidePuzzleTutorialScramble>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={SLIDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={slidePuzzleTutorial.intro}
      rules={slidePuzzleTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={
        offStepAnswer?.progress === progress
          ? offStepAnswer.message
          : getTutorialMessage(slidePuzzleTutorial, progress, {
              entry: finish.entry,
              // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
              violationSettled: true,
            })
      }
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
