import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import {
  describeTsumeShogiOperation,
  type TsumeShogiOperation,
} from "@/games/tsume-shogi/play/tsume-shogi-operation";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  findTsumeShogiDefenderKing,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  canUndoTsumeShogiSession,
  getTsumeShogiSessionPhase,
  isTsumeShogiSessionOnWrongLine,
  type TsumeShogiSessionTurn,
} from "@/games/tsume-shogi/session/session";
import {
  findTsumeShogiTutorialHint,
  getTsumeShogiTutorialHintKeySquares,
  getTsumeShogiTutorialMark,
  getTsumeShogiTutorialProgressRatio,
  TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT,
  type TsumeShogiTutorialAction,
  type TsumeShogiTutorialBoardState,
  type TsumeShogiTutorialMark,
  type TsumeShogiTutorialRuleId,
  type TsumeShogiTutorialSituation,
  type TsumeShogiTutorialTarget,
  tsumeShogiTutorial,
} from "@/games/tsume-shogi/tutorial/tutorial";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { tsumeShogiBoardGroupSizeStyle } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import { TsumeShogiGround } from "@/games/tsume-shogi/ui/TsumeShogiGround";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { TsumeShogiTutorialBoard } from "@/games/tsume-shogi/ui/TsumeShogiTutorial/TsumeShogiTutorialBoard";
import { useTsumeShogiSoundEffects } from "@/games/tsume-shogi/ui/use-tsume-shogi-sound-effects";
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

type TsumeShogiTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。渡さなければプレイ中に開いたとする。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type TsumeShogiTutorialProgress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

/** 盤の欄の左右の余白はチュートリアルの画面が取っているので、盤を卓に置いて見せる左右の余白は重ねない。 */
const tutorialBoardGroupSizeStyle = {
  ...tsumeShogiBoardGroupSizeStyle,
  "--board-gutter": "0px",
} as CSSProperties;

/** 玉方が応じて次の手順へ進んでから、次の印を付けるまでの間。玉が動き終えるのを見届けてから、次の印に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 450;

/** 成・不成を選ぶ間の一言。銀で王手する手順で、成っても成らなくても王手になる。 */
const promotionMessage: TutorialMessage = {
  headline: "成ると裏返って\n動きが変わります",
  detail: "成っても成らなくても王手です",
};

const goalState = tsumeShogiTutorial.goal();

const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 盤の中を薄く覆い、元の明るさで残す升。決め手（王手をかける玉や、王手した駒を取る駒）と、押す升と、選んでいる駒。
 * 決め手の無い手順（操作を教える手順と待ったの手順）と、手を示していない間と、待ったへ向かわせる間は覆わない。
 */
function getSpotlitSquares(
  state: TsumeShogiTutorialBoardState,
  keySquares: readonly TsumeShogiSquare[],
  target: TsumeShogiTutorialTarget | null,
  mark: TsumeShogiTutorialMark | null,
): TsumeShogiSquare[] | null {
  if (
    keySquares.length === 0 ||
    target === null ||
    target.type === "undo" ||
    mark?.type === "undo"
  ) {
    return null;
  }
  return [
    ...keySquares,
    ...(mark?.type === "square" ? [mark.square] : []),
    ...(state.selection?.type === "board" ? [state.selection.square] : []),
  ];
}

export function TsumeShogiTutorial({
  open,
  playStart,
  onClose,
}: TsumeShogiTutorialProps) {
  const [progress, setProgress] = useState<TsumeShogiTutorialProgress>(() =>
    startTutorial(tsumeShogiTutorial),
  );
  // 盤面の操作の知らせ。最初からやり直しても前の回と重ならない `id` を振る。
  const [operation, setOperation] = useState<TsumeShogiOperation | null>(null);
  const operationIdRef = useRef(0);
  // 待ったで盤面に戻ってきた最後の組。指し直したときのように動かして見せない。
  const [restoredTurn, setRestoredTurn] =
    useState<TsumeShogiSessionTurn | null>(null);
  const [steppedProgress, setSteppedProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  const [cueReadyProgress, setCueReadyProgress] =
    useState<TsumeShogiTutorialProgress | null>(null);
  // 「ヒント」を押したときに盤面に指してあった手の組。駒を選ぶ間は手がかりを残し、次の手を指したら消す。
  const [hintRequestedTurns, setHintRequestedTurns] = useState<
    readonly TsumeShogiSessionTurn[] | null
  >(null);
  // 行き先を自分で選ばせる手順で、ルールに合わない手を指した手順。
  const [missedStepIndex, setMissedStepIndex] = useState<number | null>(null);
  // 手を引いている間に印の無い所を押されたら、押されるたびに印の線を短く濃くして戻す。
  const [recall, setRecall] = useState<{
    progress: TsumeShogiTutorialProgress;
    id: number;
  } | null>(null);
  const situation: TsumeShogiTutorialSituation = getTutorialSituation(
    tsumeShogiTutorial,
    progress,
  );
  const { step } = situation;
  const guiding = step !== null;
  const playing = progress.phase === "playing";
  const session = progress.boardState;
  const sessionPhase = getTsumeShogiSessionPhase(session);
  const recallId = recall?.progress === progress ? recall.id : null;
  // 手順を進めた直後は、玉が動き終えるのを見届けてから次の印を付ける。
  const cueWaiting =
    playing && progress === steppedProgress && cueReadyProgress !== progress;
  const hintShown = playing && !guiding && hintRequestedTurns === session.turns;
  const fixingWrongLine =
    playing && !guiding && isTsumeShogiSessionOnWrongLine(session);
  function getGuidedTarget(): TsumeShogiTutorialTarget | null {
    if (step === null) {
      return null;
    }
    return step.target.type === "choice" &&
      missedStepIndex === progress.stepIndex &&
      !isTsumeShogiSessionOnWrongLine(session)
      ? { type: "move", move: step.target.move }
      : step.target;
  }
  const target: TsumeShogiTutorialTarget | null =
    !playing || cueWaiting
      ? null
      : (getGuidedTarget() ??
        (fixingWrongLine
          ? { type: "undo" }
          : hintShown
            ? findTsumeShogiTutorialHint(session)
            : null));
  const mark = target ? getTsumeShogiTutorialMark(target, session) : null;
  const keySquares =
    step?.keySquares ??
    (hintShown ? getTsumeShogiTutorialHintKeySquares(session) : []);
  const spotlitSquares = getSpotlitSquares(session, keySquares, target, mark);
  const kingSquare = findTsumeShogiDefenderKing(session.puzzleState);
  // 逃れられた王手を直す間は、待ったに印を付けているので、手がかりを求めさせない。
  const hintRequestable =
    playing &&
    !guiding &&
    !hintShown &&
    !fixingWrongLine &&
    findTsumeShogiTutorialHint(session) !== null;

  useTsumeShogiSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    kingSquare,
  );

  useEffect(() => {
    if (!open || !cueWaiting) {
      return;
    }
    const timer = window.setTimeout(
      () => setCueReadyProgress(progress),
      NEXT_STEP_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, cueWaiting]);

  const dispatch = useCallback(
    (action: TsumeShogiTutorialAction) => {
      const next = performTutorialAction(tsumeShogiTutorial, progress, action);
      if (next === progress) {
        if (guiding && action.type !== "defender-reply") {
          setRecall((current) => ({
            progress,
            id: current?.progress === progress ? current.id + 1 : 0,
          }));
        }
        return;
      }
      setProgress(next);
      if (next.stepIndex !== progress.stepIndex) {
        setSteppedProgress(next);
      }
      if (next.violated && guiding) {
        setMissedStepIndex(next.stepIndex);
      }
      const rewound =
        next.boardState.turns.length < progress.boardState.turns.length;
      if (rewound) {
        setRestoredTurn(next.boardState.turns.at(-1) ?? null);
        setOperation(null);
        return;
      }
      const operationType = describeTsumeShogiOperation(
        progress.boardState,
        next.boardState,
      );
      if (operationType) {
        operationIdRef.current += 1;
        setOperation({ id: operationIdRef.current, type: operationType });
      }
    },
    [progress, guiding],
  );

  useEffect(() => {
    if (!open || !session.defenderReplyPending) {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "defender-reply" }),
      TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, session.defenderReplyPending, dispatch]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function restart(): void {
    setSteppedProgress(null);
    setCueReadyProgress(null);
    setHintRequestedTurns(null);
    setMissedStepIndex(null);
    setRecall(null);
    setOperation(null);
    setRestoredTurn(null);
    setProgress(startTutorial(tsumeShogiTutorial));
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

  /**
   * 印の線を濃くし直したときは、印の無い所を押されたときの一言か、印へ向かう手順の一言に戻す。逃れられた王手を待ったで直す間は、違反の一言を残す。
   * 成・不成を選ぶ間は、成ることの一言を出す。行き先を自分で選ばせる手で駒を選んだら、行き先の印の代わりに、
   * 王手の升を自分で選ぶことを伝える。
   */
  function getMessage(): TutorialMessage {
    if (playing && guiding && session.promotionChoice !== null) {
      return promotionMessage;
    }
    if (recallId !== null && step && !progress.violated) {
      return step.strayMessage ?? step.message;
    }
    if (
      target?.type === "choice" &&
      session.selection !== null &&
      !progress.violated
    ) {
      return target.choosingMessage;
    }
    return getTutorialMessage(tsumeShogiTutorial, progress, {
      entry: finish.entry,
      // 1回の押す操作で決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    return (
      <TsumeShogiPieceDefs>
        <div
          className="flex size-full items-start justify-center"
          style={tutorialBoardGroupSizeStyle}
        >
          <TutorialCrossFadeIntroScene
            scene={scene}
            playing={scenePlaying}
            onSceneEnd={onSceneEnd}
          >
            {(showsGoal) => (
              <div className="flex size-full items-start justify-center">
                <TsumeShogiTutorialBoard
                  state={showsGoal ? goalState : session}
                  goalShown={showsGoal}
                  clearing={!showsGoal && progress.phase === "solved"}
                  mated={
                    showsGoal ||
                    progress.phase === "solved" ||
                    progress.phase === "completed"
                  }
                  acceptsInput={
                    !showsGoal && playing && sessionPhase === "attacker"
                  }
                  solving={!showsGoal && playing}
                  waitingForReply={playing && sessionPhase === "defender"}
                  mark={showsGoal || scene !== null ? null : mark}
                  recallId={recallId}
                  restoredTurn={restoredTurn}
                  spotlitSquares={
                    showsGoal || scene !== null ? null : spotlitSquares
                  }
                  canUndo={canUndoTsumeShogiSession(session)}
                  onAction={dispatch}
                  onClearAnimationComplete={handleClearAnimationComplete}
                />
              </div>
            )}
          </TutorialCrossFadeIntroScene>
        </div>
      </TsumeShogiPieceDefs>
    );
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={TSUME_SHOGI_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<TsumeShogiGround />}
      intro={tsumeShogiTutorial.intro}
      recap={tsumeShogiTutorial.rules.map((rule) => rule.label)}
      message={getMessage()}
      phase={progress.phase}
      spotlighting={spotlitSquares !== null}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getTsumeShogiTutorialProgressRatio(progress.stepIndex)
      }
      progressStepCount={TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <TsumeShogiHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable ? () => setHintRequestedTurns(session.turns) : null
      }
      onClose={handleClose}
    />
  );
}
