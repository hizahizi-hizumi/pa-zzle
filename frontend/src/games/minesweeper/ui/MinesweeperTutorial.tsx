import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  adjustMinesweeperTutorialMessage,
  findMinesweeperTutorialHintCellIndex,
  getMinesweeperTutorialCells,
  getMinesweeperTutorialClosingCellIndices,
  getMinesweeperTutorialCounts,
  getMinesweeperTutorialCue,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialRuleId,
  minesweeperTutorial,
} from "@/games/minesweeper/tutorial/tutorial";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperTutorialRewind } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialRewind";
import { MinesweeperTutorialStatus } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type MinesweeperTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type MinesweeperTutorialProgress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

/** 手を離した後、手が止まってから開けるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = minesweeperTutorial.goal();
const closingCellIndices = getMinesweeperTutorialClosingCellIndices();

/**
 * 6×6 の盤面を、一言と印に沿って一緒に開き、数字の読み方と操作を1つずつ身につけさせる。
 * 手順を終えたら手を離し、残りを自分で開かせる。盤面・切り替え・完成の脈打ちは本番と同じ部品を使う。
 */
export function MinesweeperTutorial({
  open,
  onStartPlay,
  onClose,
}: MinesweeperTutorialProps) {
  const [progress, setProgress] = useState<MinesweeperTutorialProgress>(() =>
    startTutorial(minesweeperTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<MinesweeperTutorialProgress | null>(null);
  // 手を引いている間に印の無いところを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  const situation = getTutorialSituation(minesweeperTutorial, progress);
  const { boardState } = progress;
  const guiding = situation.step !== null;
  const idleHintWaiting = progress.phase === "playing" && !guiding;
  const cue = getMinesweeperTutorialCue(situation, boardState);
  const idleHintCellIndex =
    idleHintWaiting && idleProgress === progress
      ? findMinesweeperTutorialHintCellIndex(situation, boardState)
      : null;

  useEffect(() => {
    if (!open || !idleHintWaiting) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, idleHintWaiting]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function perform(action: MinesweeperTutorialAction): void {
    const next = performTutorialAction(minesweeperTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        setHintCueId((id) => id + 1);
      }
      // 受け付けなかった手のあとに、前に踏んだ地雷の一言を残さない。
      if (progress.violated) {
        setProgress({ ...progress, violated: false });
      }
      return;
    }
    setProgress(next);
  }

  function handleRevealCell(cellIndex: number): void {
    perform({ type: "reveal", cellIndex });
  }

  function handleToggleFlag(cellIndex: number): void {
    perform({ type: "flag", cellIndex });
  }

  function handleChordCell(cellIndex: number): void {
    perform({ type: "chord", cellIndex });
  }

  function handleModeChange(mode: MinesweeperInputMode): void {
    perform({ type: "change-mode", mode });
  }

  function restart(): void {
    setIdleProgress(null);
    setProgress(startTutorial(minesweeperTutorial));
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

  function getCellCues(cuesShown: boolean): MinesweeperCellCue[] {
    if (!cuesShown) {
      return [];
    }
    const focusCues = (situation.step?.focusCellIndices ?? []).map(
      (cellIndex): MinesweeperCellCue => ({ cellIndex, kind: "focus", id: 0 }),
    );
    const hintCellIndex = cue === null ? idleHintCellIndex : cue.cellIndex;
    const hintCues: MinesweeperCellCue[] =
      hintCellIndex === null
        ? []
        : [{ cellIndex: hintCellIndex, kind: "hint", id: hintCueId }];
    return [...focusCues, ...hintCues];
  }

  /** 始めの盤面の場面では、解き終えた盤面から閉じるマスの中身を消し、消し終えたら始めの盤面に替える。 */
  function renderBoard({
    scene,
    playing,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && playing);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    const cuesShown = scene === null && messageShown;
    const counts = getMinesweeperTutorialCounts(shownBoardState);
    const interactive = scene === null && progress.phase === "playing";
    return (
      <div className="flex w-[min(100cqw,calc(100cqh-3.5rem),28rem)] flex-col gap-2">
        <MinesweeperTutorialStatus
          mineCount={counts.mineCount}
          flagCount={counts.flagCount}
          mistakeCount={counts.mistakeCount}
          mode={shownBoardState.mode}
          countsFocused={cuesShown && (situation.step?.focusCounts ?? false)}
          modeCued={cuesShown && (cue?.modeCued ?? false)}
          modeCueId={hintCueId}
          modeHidden={!interactive}
          onModeChange={handleModeChange}
        />
        <MinesweeperClearAnimation
          active={progress.phase === "solved" || (scene === "goal" && playing)}
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <MinesweeperTutorialRewind
            active={scene === "start" && playing}
            closingCellIndices={closingCellIndices}
            onComplete={onSceneEnd}
          >
            <MinesweeperBoard
              rows={6}
              columns={6}
              cells={getMinesweeperTutorialCells(shownBoardState)}
              mode={shownBoardState.mode}
              interactionDisabled={!interactive}
              cues={getCellCues(cuesShown)}
              onRevealCell={handleRevealCell}
              onToggleFlag={handleToggleFlag}
              onChordCell={handleChordCell}
            />
          </MinesweeperTutorialRewind>
        </MinesweeperClearAnimation>
      </div>
    );
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={MINESWEEPER_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={minesweeperTutorial.intro}
      rules={minesweeperTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={adjustMinesweeperTutorialMessage(
        situation,
        boardState,
        getTutorialMessage(minesweeperTutorial, progress, {
          entry: finish.entry,
          // 切り替えの途中で一瞬だけ違反になる手が無いので、違反はすぐ言う。
          violationSettled: true,
        }),
      )}
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
