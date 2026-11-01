import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
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
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type TakuzuTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type TakuzuTutorialProgress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

/**
 * ルールに合わない手に、置いたタイルの揺れと違反の一言で応えるまでの間。
 * 空き→四角→丸と切り替える途中の四角が一瞬だけ違反になっても画面が揺れないよう、違反が続いたときだけ応える。
 * 盤面の違反の印の遅れ（240ms）より長く取り、ゆっくり続けて押す間隔（300〜400ms）でも出ず、手を止めればすぐ分かる長さにする。
 */
const VIOLATION_REACTION_DELAY_MS = 500;

/** 手順どおりに置いてから次の印を付けるまでの間。決め手が光って消えるのを見届けてから示す。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = takuzuTutorial.goal();

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
 * 違反の揺れは、違反が続いたとき（`violationSettled`）だけ返す。
 * 印の合図は `hintCueId` が変わったときだけやり直し、手を置くたびには付け直さない。
 */
function getCellCues(
  state: TakuzuTutorialBoardState,
  violationSettled: boolean,
  hintCellIndices: readonly number[],
  hintCueId: number,
): TakuzuCellCue[] {
  return [
    ...getMoveCues(state, violationSettled),
    ...hintCellIndices.map(
      (cellIndex): TakuzuCellCue => ({
        cellIndex,
        kind: "hint",
        id: hintCueId,
      }),
    ),
  ];
}

/** 直前の手への合図。違反の揺れか、ルールに合う手なら手順のマスを正しく置いた合図と決め手の光。 */
function getMoveCues(
  { lastMove, moveCount }: TakuzuTutorialBoardState,
  violationSettled: boolean,
): TakuzuCellCue[] {
  if (!lastMove) {
    return [];
  }
  if (lastMove.violated) {
    return violationSettled
      ? [{ cellIndex: lastMove.cellIndex, kind: "rejected", id: moveCount }]
      : [];
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
  onStartPlay,
  onClose,
}: TakuzuTutorialProps) {
  const [progress, setProgress] = useState<TakuzuTutorialProgress>(() =>
    startTutorial(takuzuTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  // 手を引いている間に印の無いマスを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  // 固定マスへの操作は本番と同じく、通らない操作として盤面に知らせて揺らす。
  const [givenCellOperation, setGivenCellOperation] =
    useState<TakuzuOperation | null>(null);
  const violationTimerRef = useRef<number | null>(null);
  const situation = getTutorialSituation(takuzuTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const cellViews = getTakuzuTutorialCellViews(situation, boardState);
  const violationSettled = settledViolationProgress === progress;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 || (cueDelayMs !== null && idleProgress === progress);
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
      if (violationTimerRef.current !== null) {
        window.clearTimeout(violationTimerRef.current);
      }
    };
  }, []);

  function cancelViolationReaction(): void {
    if (violationTimerRef.current !== null) {
      window.clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
    }
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(action: TakuzuTutorialAction): void {
    if (cellViews[action.cellIndex]?.given) {
      setGivenCellOperation((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "invalid",
        cellIndex: action.cellIndex,
      }));
      return;
    }
    const next = performTutorialAction(takuzuTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setProgress(next);
    // 次の手が来たら、前の手の違反には応えない。
    cancelViolationReaction();
    if (next.violated) {
      violationTimerRef.current = window.setTimeout(() => {
        violationTimerRef.current = null;
        setSettledViolationProgress(next);
      }, VIOLATION_REACTION_DELAY_MS);
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
    cancelViolationReaction();
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setGivenCellOperation(null);
    setProgress(startTutorial(takuzuTutorial));
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
              cells={getTakuzuTutorialCellViews(situation, shownBoardState)}
              lineViolations={getTakuzuTutorialLineViolations(
                situation,
                shownBoardState,
              )}
              operation={givenCellOperation}
              interactionDisabled={progress.phase !== "playing"}
              cues={getCellCues(
                boardState,
                violationSettled,
                hintCellIndices,
                hintCueId,
              )}
              onCycleCell={handleCycleCell}
              onPlaceCell={handlePlaceCell}
            />
          </TakuzuTutorialRewind>
        </TakuzuClearAnimation>
      </div>
    );
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title="バイナリパズル"
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
