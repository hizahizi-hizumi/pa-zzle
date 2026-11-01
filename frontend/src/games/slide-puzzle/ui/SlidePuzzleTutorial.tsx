import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleBoard as SlidePuzzleBoardState } from "@/games/slide-puzzle/puzzle/state";
import {
  findSlidePuzzleTutorialHintTile,
  getSlidePuzzleTutorialStepTile,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  slidePuzzleTutorial,
} from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { SlidePuzzleTutorialScramble } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial/SlidePuzzleTutorialScramble";
import { useSlidePuzzleSoundEffects } from "@/games/slide-puzzle/ui/use-slide-puzzle-sound-effects";
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

/** 本番の効果音を鳴らすための進行。導入でゴールを見せる波は完成ではないので、解いたときだけ完成演出として鳴らす。 */
function getSoundProgress(phase: TutorialPhase): GameProgress {
  switch (phase) {
    case "intro":
    case "playing":
      return "playing";
    case "solved":
      return "clearing";
    case "completed":
      return "result";
  }
}

/** 手の結果を、盤面のスライドか揺れの動きにする。 */
function createOperation(
  id: number,
  before: SlidePuzzleBoardState,
  next: SlidePuzzleTutorialProgress,
): SlidePuzzleOperation | null {
  const { lastMove, board } = next.boardState;
  switch (lastMove?.type) {
    case "rejected":
      return { id, type: "invalid", tileIndex: lastMove.cellIndex };
    case "slid":
      return {
        id,
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
 * 手を引いている間は、スライドが収まってから印を付け、スライドしなかった手の後は付けたままにする。手を離した後は手が止まったときだけ付ける。
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
  return progress.boardState.lastMove?.type === "slid"
    ? NEXT_STEP_CUE_DELAY_MS
    : 0;
}

/** `reminderId` があれば、印のタイルを光らせ直す。`reminderId` が変わるたびに光らせ直す。 */
function getTileCues(
  state: SlidePuzzleTutorialBoardState,
  hintTile: number | null,
  reminderId: number | null,
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
        reminderId === null
          ? { tile: hintTile, kind: "hint", id: 0 }
          : { tile: hintTile, kind: "reminder", id: reminderId },
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
  // 効果音は同じ `id` の動きで一度しか鳴らないので、最初からやり直しても前の回と重ならない `id` を振る。
  const operationIdRef = useRef(0);
  const [idleProgress, setIdleProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  // 手を引いている間に、ルールに当たらない印の無いタイルを押されたら、進行が変わるまで印を光らせ直し続ける。
  // 揺れと違反の一言はルールに当たった手にだけ返すので、ここでは印へ目を向けさせるだけにする。
  const [reminder, setReminder] = useState<{
    progress: SlidePuzzleTutorialProgress;
    id: number;
  } | null>(null);
  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const reminderId = reminder?.progress === progress ? reminder.id : null;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 ||
    reminderId !== null ||
    (cueDelayMs !== null && idleProgress === progress);
  const hintTile = !cueShown
    ? null
    : guiding
      ? getSlidePuzzleTutorialStepTile(situation)
      : findSlidePuzzleTutorialHintTile(boardState);

  useSlidePuzzleSoundEffects(
    operation,
    getSoundProgress(progress.phase),
    goalBoard.length - 1,
  );

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
        setReminder((current) => ({
          progress,
          id: current?.progress === progress ? current.id + 1 : 0,
        }));
      }
      return;
    }
    setProgress(next);
    operationIdRef.current += 1;
    setOperation(
      createOperation(operationIdRef.current, progress.boardState.board, next),
    );
  }

  function restart(): void {
    setIdleProgress(null);
    setReminder(null);
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

  /**
   * 印を光らせ直したときと、手を離した後に止まって印が出たときは、前の違反の一言を下げて、
   * 印のタイルへ向かう手順の一言か、残りを収める一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (reminderId !== null || (!guiding && hintTile !== null)) {
      return situation.step?.message ?? slidePuzzleTutorial.freePlay;
    }
    return getTutorialMessage(slidePuzzleTutorial, progress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
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
                  ? getTileCues(boardState, hintTile, reminderId)
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
      message={getMessage()}
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
