import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import {
  createIceFloorMazeLastSlide,
  type IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeSlide,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";
import { getIceFloorMazeBoardViewBox } from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { getIceFloorMazeSlideDurationMs } from "@/games/ice-floor-maze/ui/board/slide-timing";
import { goalFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import {
  getIceFloorMazeFigureSizeStyle,
  iceFloorMazeGoalCellMaxClassName,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-size";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。遊び方の層が開き切ってから、駒・ゴール・岩の場所を読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 1400;

/** 滑り終えてから次に滑らせるまでの間。止まった所と跡を目で追える長さにする。 */
const GOAL_SLIDE_GAP_MS = 600;

const { board, start, goal, solution } = goalFigure;

type IceFloorMazeSlid = Extract<IceFloorMazeSlide, { status: "slid" }>;

/** 解き終えるまでの状態と滑り。`states[0]` が始まりで、`slides[k]` で `states[k]` から `states[k + 1]` へ移る。 */
function createPlayback() {
  const states: IceFloorMazeState[] = [
    createIceFloorMazeInitialState(board, start),
  ];
  const slides: IceFloorMazeSlid[] = [];
  for (const direction of solution) {
    const current = states.at(-1)!;
    const slide = slideIceFloorMazePiece(board, current, direction);
    if (slide.status !== "slid") {
      throw new RangeError("Ice floor maze goal figure must slide");
    }
    states.push(applyIceFloorMazeSlide(current, slide));
    slides.push(slide);
  }
  return { states, slides };
}

const playback = createPlayback();

/** 何手目を何ミリ秒後に始めるか（1手目から）。始まりの盤面を見せてから、前の滑りを終えて少し置いて次を始める。 */
function listSlideStartsMs() {
  const starts: number[] = [];
  let startMs = GOAL_START_HOLD_MS;
  for (const slide of playback.slides) {
    starts.push(startMs);
    startMs +=
      getIceFloorMazeSlideDurationMs(slide.path.length) + GOAL_SLIDE_GAP_MS;
  }
  return starts;
}

const slideStartsMs = listSlideStartsMs();

const finalStep = playback.slides.length;

/** 盤面のマスの大きさ。置き場所の幅と、高さ（広い画面で渡される）から見せ直すボタンの段と、遊び方の層が盤面の下に置くボタンの段を除いた高さの、小さい方に盤面を合わせる。 */
const goalSizeStyle = {
  "--ice-floor-maze-figure-cell": `min(calc(min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) / ${getIceFloorMazeBoardViewBox(board).width}), var(--ice-floor-maze-goal-cell-max, 100cqw))`,
} as CSSProperties;

function createLastSlide(step: number, id: number): IceFloorMazeLastSlide {
  return createIceFloorMazeLastSlide({
    id,
    board,
    goal,
    slide: playback.slides[step - 1]!,
    isClearingMove: step === finalStep,
    entersTrap: false,
  });
}

function ignoreSlideAnimationActivity(): void {}

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から最短の手を本番の盤面部品で1手ずつ滑らせ、ゴールで止まったら
 * 本番の完成演出を1回だけ返す。音は鳴らさない。
 * 滑らせている途中と完成演出の途中に盤面を押すと、残りを飛ばして、ゴールで止まった最後の姿をすぐ見せる。
 * 解き終えた後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を見せてから、ゴールで止まった盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [settled, setSettled] = useState(false);
  // 飛ばしたときと動きを減らす設定では、最後の滑りの動きと完成演出を見せない。
  const [jumped, setJumped] = useState(false);

  // 滑らせていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    if (prefersReducedMotion()) {
      const timer = window.setTimeout(() => {
        setStep(finalStep);
        setJumped(true);
        setSettled(true);
      }, GOAL_START_HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    const timers = slideStartsMs.map((startMs, index) =>
      window.setTimeout(() => setStep(index + 1), startMs),
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled]);

  // 盤面は直前の滑りが替わったときだけ動かすので、同じ手の間は同じ値を渡す。手の番号は見せ直すたびに替える。
  const lastSlide = useMemo(
    () =>
      step === 0 || jumped
        ? null
        : createLastSlide(step, playCount * (finalStep + 1) + step),
    [step, jumped, playCount],
  );

  const finishCelebration = useCallback(() => {
    setSettled(true);
  }, []);

  function skipToGoal() {
    setStep(finalStep);
    setJumped(true);
    setSettled(true);
  }

  function replay() {
    setStep(0);
    setJumped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const { cells, blocks, position } = playback.states[step]!;
  return (
    <div className={iceFloorMazeGoalCellMaxClassName} style={goalSizeStyle}>
      <HowToPlayGoalFrame
        board={
          <div
            role="img"
            aria-label="ゴールの盤面"
            className="flex flex-col"
            style={getIceFloorMazeFigureSizeStyle(board)}
          >
            <IceFloorMazeBoard
              board={board}
              cells={cells}
              blocks={blocks}
              goal={goal}
              position={position}
              lastSlide={lastSlide}
              blockedInput={null}
              clearing={step === finalStep && !settled}
              onSlideAnimationActivityChange={ignoreSlideAnimationActivity}
              onClearAnimationComplete={finishCelebration}
            />
          </div>
        }
        skippable={!settled}
        skipLabel="ゴールで止まった姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = { GOAL_START_HOLD_MS, slideStartsMs, playback };
