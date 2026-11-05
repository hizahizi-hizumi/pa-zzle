import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell, TakuzuTile } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialStepCellIndices,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialRuleId,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuTutorialRewind } from "@/games/takuzu/ui/TakuzuTutorial/TakuzuTutorialRewind";
import { useTakuzuSoundEffects } from "@/games/takuzu/ui/use-takuzu-sound-effects";
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

type TakuzuTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type TakuzuTutorialProgress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

/**
 * ルールに合わない手に、違反の一言で応えるまでの間。
 * 空き→四角→丸と切り替える途中の四角が一瞬だけ違反になっても一言が替わらないよう、違反が続いたときだけ応える。
 * 盤面の違反の印の遅れ（240ms）より長く取り、ゆっくり続けて押す間隔（300〜400ms）でも出ず、手を止めればすぐ分かる長さにする。
 */
const VIOLATION_REACTION_DELAY_MS = 500;

/**
 * 手順のマスを正しい手へ向かう途中にしたまま手が止まってから、盤面にルールに合わないところを見せるまでの間。
 * 教わったばかりの2回タップを、確かめながらゆっくり押す間隔でも出ないよう、違反の一言と揺れより長く取る。
 */
const TOWARD_STEP_REVEAL_DELAY_MS = 1000;

/** 手順どおりに置いてから次の印を付けるまでの間。決め手が光って消えるのを見届けてから示す。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = takuzuTutorial.goal();

/**
 * 手を引いている間に印の無いマスを押されたときの、印の光らせ直し。
 * - `id`: 押されるたびに増やし、続けて押されても光らせ直す。
 * - `progress`: 押されたときの進行。手が進んだら光らせ直しを終える。
 */
type TakuzuTutorialRecall = {
  id: number;
  progress: TakuzuTutorialProgress;
};

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。解けた盤面の演出の間が、本番の完成演出の間に当たる。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、印のマスにしか置けないので、違反があっても付け続ける。
 * 手を離した後は手が止まったときだけ付け、違反がある間は直すことに向かわせるため付けない。
 */
function getCueDelayMs(
  progress: TakuzuTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  const { lastMove } = progress.boardState;
  if (!guiding) {
    return progress.violated || lastMove?.violated ? null : IDLE_HINT_DELAY_MS;
  }
  const reasoned = (lastMove?.reasonCellIndices.length ?? 0) > 0;
  return reasoned ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/**
 * ルールに合わない手は、本番と同じ違反の印だけで示し、タイルは揺らさない。
 * 印は手を置くたびには付け直さず、光らせ直すとき（`recallId`）だけ光を重ねる。
 */
function getCellCues(
  state: TakuzuTutorialBoardState,
  hintCellIndices: readonly number[],
  recallId: number | null,
): TakuzuCellCue[] {
  return [
    ...getMoveCues(state),
    ...hintCellIndices.map(
      (cellIndex): TakuzuCellCue =>
        recallId === null
          ? { cellIndex, kind: "hint", id: 0 }
          : { cellIndex, kind: "recall", id: recallId },
    ),
  ];
}

/** 直前の手への合図。ルールに合う手なら、手順のマスを正しく置いた合図と決め手の光。 */
function getMoveCues({
  lastMove,
  moveCount,
}: TakuzuTutorialBoardState): TakuzuCellCue[] {
  if (!lastMove || lastMove.violated) {
    return [];
  }
  const fittedCues: TakuzuCellCue[] = lastMove.fitsStep
    ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
    : [];
  return [
    ...fittedCues,
    ...lastMove.reasonCellIndices.map(
      (cellIndex): TakuzuCellCue => ({
        cellIndex,
        kind: "reason",
        id: moveCount,
      }),
    ),
  ];
}

/**
 * 4×4 の盤面を、一言と印に沿って1マスずつ一緒に埋め、ルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分で埋めさせる。盤面・違反の印・解けたときの波は本番と同じ部品を使う。
 */
export function TakuzuTutorial({
  open,
  playStart,
  onClose,
}: TakuzuTutorialProps) {
  const [progress, setProgress] = useState<TakuzuTutorialProgress>(() =>
    startTutorial(takuzuTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledTowardStepProgress, setSettledTowardStepProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [recall, setRecall] = useState<TakuzuTutorialRecall | null>(null);
  // 本番と同じく、置いた・消した・固定マスで通らなかったを知らせ、音を鳴らす。固定マスは盤面が揺らす。
  const [operation, setOperation] = useState<TakuzuOperation | null>(null);
  // 開き直しても同じ知らせとみなされないよう、もう一度始めても数え直さない。
  const operationIdRef = useRef(0);
  const reactionTimerRef = useRef<number | null>(null);
  const situation = getTutorialSituation(takuzuTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const towardStepSettled = settledTowardStepProgress === progress;
  const cellViews = getTakuzuTutorialCellViews(
    situation,
    boardState,
    towardStepSettled,
  );
  const violationSettled = settledViolationProgress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    (guiding && recallId !== null) ||
    cueDelayMs === 0 ||
    (cueDelayMs !== null && idleProgress === progress);

  useTakuzuSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    boardState.board.size,
  );
  const idleHintCellIndex =
    cueShown && !guiding
      ? findTakuzuTutorialHintCellIndex(situation, boardState)
      : null;
  const hintCellIndices = !cueShown
    ? []
    : guiding
      ? getTakuzuTutorialStepCellIndices(situation, boardState)
      : idleHintCellIndex === null
        ? []
        : [idleHintCellIndex];

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

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current !== null) {
        window.clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  function cancelPendingReaction(): void {
    if (reactionTimerRef.current !== null) {
      window.clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }
  }

  /** 手の後、盤面が変わらないまま `delayMs` が過ぎたら、その手の進行を `settle` に渡す。 */
  function scheduleReaction(
    next: TakuzuTutorialProgress,
    delayMs: number,
    settle: (progress: TakuzuTutorialProgress) => void,
  ): void {
    reactionTimerRef.current = window.setTimeout(() => {
      reactionTimerRef.current = null;
      settle(next);
    }, delayMs);
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function notifyOperation(
    notice:
      | { type: "placed"; tile: TakuzuTile }
      | { type: "emptied" }
      | { type: "invalid"; cellIndex: number },
  ): void {
    operationIdRef.current += 1;
    setOperation({ ...notice, id: operationIdRef.current });
  }

  /** 印の無いマスを押されたら、赤は使わず、印を光らせ直して目を向けさせる。 */
  function recallHint(): void {
    setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
  }

  function perform(action: TakuzuTutorialAction): void {
    if (progress.phase !== "playing") {
      return;
    }
    if (cellViews[action.cellIndex]?.given) {
      notifyOperation({ type: "invalid", cellIndex: action.cellIndex });
      if (guiding) {
        recallHint();
      }
      return;
    }
    const next = performTutorialAction(takuzuTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        recallHint();
      }
      return;
    }
    const placed = next.boardState.board.cells[action.cellIndex] ?? null;
    notifyOperation(
      placed === null ? { type: "emptied" } : { type: "placed", tile: placed },
    );
    setProgress(next);
    // 次の手が来たら、前の手には応えない。
    cancelPendingReaction();
    if (next.violated) {
      scheduleReaction(
        next,
        VIOLATION_REACTION_DELAY_MS,
        setSettledViolationProgress,
      );
    } else if (next.boardState.lastMove?.towardStep) {
      // 途中の盤面のまま手が止まったら、責めずに済ませていたルールに合わないところを盤面に出す。
      scheduleReaction(
        next,
        TOWARD_STEP_REVEAL_DELAY_MS,
        setSettledTowardStepProgress,
      );
    }
  }

  function handleCycleCell(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
    perform({ type: "cycle", cellIndex, direction });
  }

  function handlePlaceCell(cellIndex: number, cell: TakuzuCell): void {
    perform({ type: "place", cellIndex, cell });
  }

  function restart(): void {
    cancelPendingReaction();
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setSettledTowardStepProgress(null);
    setRecall(null);
    setOperation(null);
    setProgress(startTutorial(takuzuTutorial));
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

  /** 始めの盤面の場面では、解き終えた盤面から置いたタイルを消し、消し終えたら始めの盤面に替える。 */
  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && playing);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    return (
      <div className="aspect-square w-[min(100cqw,100cqh,28rem)]">
        <TakuzuClearAnimation
          active={progress.phase === "solved" || (scene === "goal" && playing)}
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <TakuzuTutorialRewind
            active={scene === "start" && playing}
            onComplete={onSceneEnd}
          >
            <TakuzuBoard
              size={shownBoardState.board.size}
              cells={getTakuzuTutorialCellViews(
                situation,
                shownBoardState,
                towardStepSettled,
              )}
              lineViolations={getTakuzuTutorialLineViolations(
                situation,
                shownBoardState,
                towardStepSettled,
              )}
              operation={operation}
              interactionDisabled={progress.phase !== "playing"}
              cues={getCellCues(boardState, hintCellIndices, recallId)}
              outlinesViolatedLines
              onCycleCell={handleCycleCell}
              onPlaceCell={handlePlaceCell}
            />
          </TakuzuTutorialRewind>
        </TakuzuClearAnimation>
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
      title={TAKUZU_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={takuzuTutorial.intro}
      rules={takuzuTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(takuzuTutorial, progress, {
        entry: finish.entry,
        violationSettled,
      })}
      phase={progress.phase}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
