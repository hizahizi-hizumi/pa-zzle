import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/hakoiri-musume/assets/pictogram.svg?raw";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import type { HakoiriMusumeStepNotice } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { hakoiriMusumeClassicLayout } from "@/games/hakoiri-musume/puzzle/classic-board";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import {
  describeHakoiriMusumeTutorialStep,
  findHakoiriMusumeTutorialHintPiece,
  getHakoiriMusumeTutorialPuzzle,
  getHakoiriMusumeTutorialStepPiece,
  type HakoiriMusumeTutorialAction,
  type HakoiriMusumeTutorialBoardState,
  type HakoiriMusumeTutorialRuleId,
  hakoiriMusumeTutorial,
  hakoiriMusumeTutorialHintMessage,
  listHakoiriMusumeTutorialDeciderPieces,
  listHakoiriMusumeTutorialTargetCells,
} from "@/games/hakoiri-musume/tutorial/tutorial";
import { getBoxExtent } from "@/games/hakoiri-musume/ui/board/board-geometry";
import { HakoiriMusumeBoard } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard";
import type { HakoiriMusumePieceCue } from "@/games/hakoiri-musume/ui/board/piece-cue";
import { useHakoiriMusumeSoundEffects } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay/use-hakoiri-musume-sound-effects";
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

type HakoiriMusumeTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type HakoiriMusumeTutorialProgress = TutorialProgress<
  HakoiriMusumeTutorialRuleId,
  HakoiriMusumeTutorialBoardState
>;

/** 手順どおりに動かし終えた駒への応えを見届けてから、次の手順の一言と印を出すまでの間。 */
const NEXT_STEP_CUE_DELAY_MS = 700;

/** 終えた手が何を示したかを言う一言を、読み終えられるだけ見せてから、次の手順の一言と印を出すまでの間。 */
const DONE_MESSAGE_DELAY_MS = 1800;

/** 手を離した後、手が止まってから次に動かす駒を示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalPieces = getHakoiriMusumeTutorialPuzzle(
  hakoiriMusumeTutorial.goal(),
).pieces;

/** 導入のゴールの盤面で、印を付けて目を向けさせる娘。 */
const goalDaughterIndex = goalPieces.findIndex(
  (piece) => piece.target !== null,
);

const classicBoxExtent = getBoxExtent(hakoiriMusumeClassicLayout);

/** 本番のプレイ画面と同じ効果音を鳴らすための進行。娘が出口から抜けていく間を完成演出とする。 */
const soundProgresses = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/** 押された所の駒の番号。駒の無い所なら `null`。 */
function findPressedPieceIndex(
  event: ReactPointerEvent<HTMLElement>,
): number | null {
  const piece =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-piece-index]")
      : null;
  return piece ? Number(piece.dataset.pieceIndex) : null;
}

/** 盤面・駒のすべる動き・娘が抜けていく演出は本番と同じ部品を使う。 */
export function HakoiriMusumeTutorial({
  open,
  playStart,
  onClose,
}: HakoiriMusumeTutorialProps) {
  const [progress, setProgress] = useState<HakoiriMusumeTutorialProgress>(() =>
    startTutorial(hakoiriMusumeTutorial),
  );
  // 最初からやり直すたびに盤面を作り直し、抜けていった娘の姿を残さない。
  const [boardKey, setBoardKey] = useState(0);
  // 駒が1マス移った知らせ。効果音は同じ `id` で一度しか鳴らないので、やり直しても前の回と重ならない `id` を振る。
  const [stepNotice, setStepNotice] = useState<HakoiriMusumeStepNotice | null>(
    null,
  );
  const noticeIdRef = useRef(0);
  const [idleProgress, setIdleProgress] =
    useState<HakoiriMusumeTutorialProgress | null>(null);
  // 手を引いている間に印の無い駒や空いたマスを押されたら、押されるたびに印の線を短く濃くして戻す。
  const [recall, setRecall] = useState<{
    progress: HakoiriMusumeTutorialProgress;
    id: number;
  } | null>(null);
  // 手順どおりに動かし終えた手の進行と、その手順を始めたときの進行。次の印を出すまで、一言とルールの並びを終えた手順のまま見せる。
  const [acknowledgedMove, setAcknowledgedMove] = useState<{
    progress: HakoiriMusumeTutorialProgress;
    previous: HakoiriMusumeTutorialProgress;
  } | null>(null);
  // 応えを見届け終えて、次の手順の一言と印を出した進行。
  const [releasedProgress, setReleasedProgress] =
    useState<HakoiriMusumeTutorialProgress | null>(null);
  // 指で押している間。なぞりの途中で印の無い駒へ届いた手は押したときに応えたので、キーボードの手と分けて扱う。
  const pointerPressedRef = useRef(false);
  const situation = getTutorialSituation(hakoiriMusumeTutorial, progress);
  const guiding = situation.step !== null;
  const playing = progress.phase === "playing";
  const { boardState } = progress;
  const holdingFinishedStep =
    playing &&
    acknowledgedMove?.progress === progress &&
    releasedProgress !== progress;
  const idleHintShown = playing && !guiding && idleProgress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const shownProgress =
    holdingFinishedStep && acknowledgedMove
      ? acknowledgedMove.previous
      : progress;
  const shownSituation = getTutorialSituation(
    hakoiriMusumeTutorial,
    shownProgress,
  );
  const finishedStep = holdingFinishedStep ? shownSituation.step : null;
  const shownGuiding = playing && shownSituation.step !== null;
  const stepPieceIndex = getHakoiriMusumeTutorialStepPiece(situation);
  const hintPieceIndex =
    !playing || holdingFinishedStep
      ? null
      : guiding
        ? stepPieceIndex
        : idleHintShown
          ? findHakoiriMusumeTutorialHintPiece(boardState)
          : null;

  useHakoiriMusumeSoundEffects(
    stepNotice,
    soundProgresses[progress.phase],
    hakoiriMusumeClassicLayout.goals.length,
  );

  useEffect(() => {
    if (!open || !holdingFinishedStep) {
      return;
    }
    const timer = window.setTimeout(
      () => setReleasedProgress(progress),
      finishedStep?.doneMessage
        ? DONE_MESSAGE_DELAY_MS
        : NEXT_STEP_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, holdingFinishedStep, finishedStep]);

  useEffect(() => {
    if (!open || !playing || guiding || holdingFinishedStep) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, playing, guiding, holdingFinishedStep]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function recallMark(): void {
    setRecall((current) => ({
      progress,
      id: current?.progress === progress ? current.id + 1 : 0,
    }));
  }

  /**
   * 手を引いている間に、印の無い駒や空いたマスを押したら、印の線を濃くし直して印へ目を向けさせる。
   * 次の印を出す前に押したら、すぐ次の手順の一言と印を出す。
   */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    pointerPressedRef.current = true;
    if (holdingFinishedStep) {
      setReleasedProgress(progress);
      return;
    }
    if (playing && guiding && findPressedPieceIndex(event) !== stepPieceIndex) {
      recallMark();
    }
  }

  function handlePointerEnd(): void {
    pointerPressedRef.current = false;
  }

  /** 進まない操作に当たったら、そこで止める。続けて移った駒の知らせは1つにまとめる。 */
  function perform(actions: readonly HakoiriMusumeTutorialAction[]): void {
    let current = progress;
    let movedFrom: number | null = null;
    let cellCount = 0;
    for (const action of actions) {
      const next = performTutorialAction(
        hakoiriMusumeTutorial,
        current,
        action,
      );
      if (next === current) {
        break;
      }
      if (next.stepIndex !== current.stepIndex) {
        setAcknowledgedMove({ progress: next, previous: current });
      }
      const { lastMove } = next.boardState;
      if (
        lastMove &&
        next.boardState.stepCount !== current.boardState.stepCount
      ) {
        movedFrom ??= lastMove.from;
        cellCount += 1;
      }
      current = next;
    }
    if (current === progress) {
      // 指でなぞる手は押したときに応えたので、キーボードで印の無い駒を動かそうとしたときだけ応える。
      if (
        guiding &&
        actions[0]?.type === "move" &&
        !pointerPressedRef.current
      ) {
        recallMark();
      }
      return;
    }
    setProgress(current);
    const { lastMove } = current.boardState;
    if (lastMove && movedFrom !== null) {
      noticeIdRef.current += 1;
      setStepNotice({
        id: noticeIdRef.current,
        pieceIndex: lastMove.pieceIndex,
        target: getHakoiriMusumeTutorialPuzzle(current.boardState).pieces[
          lastMove.pieceIndex
        ]!.target,
        from: movedFrom,
        to: lastMove.to,
        cellCount,
      });
    }
  }

  function handleMovePiece(
    pieceIndex: number,
    directions: readonly HakoiriMusumeDirection[],
  ): void {
    perform(
      directions.map((direction) => ({ type: "move", pieceIndex, direction })),
    );
  }

  function handlePushBlocked(
    pieceIndex: number,
    direction: HakoiriMusumeDirection,
  ): void {
    perform([{ type: "push", pieceIndex, direction }]);
  }

  function restart(): void {
    setAcknowledgedMove(null);
    setReleasedProgress(null);
    setIdleProgress(null);
    setRecall(null);
    setStepNotice(null);
    setBoardKey((key) => key + 1);
    setProgress(startTutorial(hakoiriMusumeTutorial));
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

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * - 娘が抜けていく間は、残りを解く一言のままにし、抜け切ってから完成の一言を出す。
   * - 手順を終えた駒への応えを見せる間は、終えた手が何を示したかの一言（無ければ終えた手順の一言）を出す。
   * - 手を引いている間は、印の駒が行き先から外れていれば、そのわけを言う。
   * - 手を離した後に止まって印が出たら、印の駒を動かすよう促す。
   */
  function getMessage(): TutorialMessage {
    if (progress.phase === "solved") {
      return hakoiriMusumeTutorial.freePlay;
    }
    if (finishedStep) {
      return finishedStep.doneMessage ?? finishedStep.message;
    }
    if (idleHintShown && hintPieceIndex !== null) {
      return hakoiriMusumeTutorialHintMessage;
    }
    return (
      describeHakoiriMusumeTutorialStep(situation, boardState) ??
      getTutorialMessage(hakoiriMusumeTutorial, progress, {
        entry: finish.entry,
        // ふさがれた手は盤面が受け付けないので、違反の途中の状態は無い。
        violationSettled: true,
      })
    );
  }

  /**
   * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せる駒。次に押す印の駒と、その手を決める駒（決め手）。
   * 手順を終えた駒への応えを見せる間は、終えた手順の駒と決め手のまま。
   */
  function getSpotlitPieceIndices(): number[] {
    if (!shownGuiding || shownSituation.step === null) {
      return [];
    }
    return [
      shownSituation.step.pieceIndex,
      ...listHakoiriMusumeTutorialDeciderPieces(shownSituation),
    ];
  }

  /** 印と合図。導入の終わりは、最初の手順の一言を出すのと同時に、最初の印を付ける。 */
  function getCues(messageShown: boolean): HakoiriMusumePieceCue[] {
    if (progress.phase === "intro") {
      return messageShown && stepPieceIndex !== null
        ? [{ pieceIndex: stepPieceIndex, kind: "mark", recallId: null }]
        : [];
    }
    if (finishedStep) {
      return [
        {
          pieceIndex: finishedStep.pieceIndex,
          kind: "acknowledgement",
          id: progress.stepIndex,
        },
      ];
    }
    return hintPieceIndex === null
      ? []
      : [{ pieceIndex: hintPieceIndex, kind: "mark", recallId }];
  }

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面で、ゴールの盤面を薄くしながら始めの盤面を浮かび上がらせる。 */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const focused = scene === null;
    return (
      // 押された所を見て印へ目を向けさせるだけで、操作は盤面が受ける。
      <div
        className="flex size-full items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          style={{
            width: `min(100cqw, min(100cqh, 44rem) * ${classicBoxExtent.width} / ${classicBoxExtent.height})`,
          }}
        >
          <TutorialCrossFadeIntroScene
            scene={scene}
            playing={scenePlaying}
            onSceneEnd={onSceneEnd}
          >
            {(showsGoal) => (
              <HakoiriMusumeBoard
                layout={hakoiriMusumeClassicLayout}
                key={showsGoal ? "goal" : boardKey}
                pieces={
                  showsGoal
                    ? goalPieces
                    : getHakoiriMusumeTutorialPuzzle(boardState).pieces
                }
                interactionDisabled={!playing || !focused}
                // 演出を終えた後も抜けていった娘を箱の外に残すため、解き終えた後は演出を止めずにおく。
                clearing={
                  !showsGoal &&
                  (progress.phase === "solved" ||
                    progress.phase === "completed")
                }
                cues={
                  showsGoal
                    ? scene === "goal"
                      ? [
                          {
                            pieceIndex: goalDaughterIndex,
                            kind: "mark",
                            recallId: null,
                          },
                        ]
                      : []
                    : focused
                      ? getCues(messageShown)
                      : []
                }
                spotlitPieceIndices={
                  !showsGoal && focused ? getSpotlitPieceIndices() : []
                }
                spotlitCells={
                  !showsGoal && focused && shownGuiding && !finishedStep
                    ? listHakoiriMusumeTutorialTargetCells(situation)
                    : []
                }
                onMovePiece={handleMovePiece}
                onPushBlocked={handlePushBlocked}
                onClearAnimationComplete={handleClearAnimationComplete}
              />
            )}
          </TutorialCrossFadeIntroScene>
        </div>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={HAKOIRI_MUSUME_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={hakoiriMusumeTutorial.intro}
      rules={hakoiriMusumeTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
      phase={progress.phase}
      guiding={shownGuiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
