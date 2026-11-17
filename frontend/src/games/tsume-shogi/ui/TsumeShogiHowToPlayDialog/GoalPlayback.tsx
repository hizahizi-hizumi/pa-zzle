import { type CSSProperties, useCallback, useEffect, useState } from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  chooseTsumeShogiSessionPromotion,
  createTsumeShogiSession,
  playTsumeShogiSessionDefenderReply,
  type TsumeShogiSession,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
} from "@/games/tsume-shogi/session/session";
import { TsumeShogiClearAnimation } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { tsumeShogiBoardFrameStyle } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup";
import { TsumeShogiHand } from "@/games/tsume-shogi/ui/TsumeShogiHand";
import { goalFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { tsumeShogiFigureSquareClassName } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-size";
import {
  HowToPlayBoard,
  TSUME_SHOGI_FIGURE_LABELED_FRAME_MAX_PX,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/HowToPlayBoard";
import { useTsumeShogiExampleView } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/use-tsume-shogi-example-view";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** 始まりの盤面を見せておく間。玉と攻方の駒・持駒の位置を読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 1000;
/** 駒を選んで持ち上げてから指すまで、成るかの選択肢を出してから選ぶまでの間。どの駒を動かすかを目で追える長さにする。 */
const GOAL_SELECT_HOLD_MS = 600;
/** 玉方の応手を見せてから、次の攻方の駒を選ぶまでの間。玉が動き終えるのを見届けられる長さにする。 */
const GOAL_REPLY_HOLD_MS = 800;

/**
 * 始まりの盤面から、本番のプレイと同じ操作で作意を指していく姿と、次の姿までの間。最後の姿は詰んだ盤面。
 * 攻方の手は、駒を選んで持ち上げた姿・成るかの選択肢を出した姿を経て指し、玉方の応手は本番と同じ間を置いて指す。
 */
function listGoalFrames(): { session: TsumeShogiSession; holdMs: number }[] {
  const { problem } = goalFigure;
  const [rookMove, kingReply, goldDrop] = problem.mainLine;
  if (
    rookMove?.kind !== "board" ||
    kingReply === undefined ||
    goldDrop?.kind !== "drop"
  ) {
    throw new Error(
      "ゴールの盤面の作意が、飛を動かし・玉が逃げ・金を打つ形ではありません",
    );
  }
  const start = createTsumeShogiSession(problem, 0);
  const rookSelected = tapTsumeShogiSessionSquare(start, rookMove.from, 0);
  const promotionOffered = tapTsumeShogiSessionSquare(
    rookSelected,
    rookMove.to,
    0,
  );
  const rookMoved = chooseTsumeShogiSessionPromotion(
    promotionOffered,
    rookMove.promote,
    0,
  );
  const kingEscaped = playTsumeShogiSessionDefenderReply(rookMoved);
  const goldSelected = tapTsumeShogiSessionHand(
    kingEscaped,
    goldDrop.pieceType,
  );
  const mated = tapTsumeShogiSessionSquare(goldSelected, goldDrop.to, 0);
  return [
    { session: start, holdMs: GOAL_START_HOLD_MS },
    { session: rookSelected, holdMs: GOAL_SELECT_HOLD_MS },
    { session: promotionOffered, holdMs: GOAL_SELECT_HOLD_MS },
    { session: rookMoved, holdMs: TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS },
    { session: kingEscaped, holdMs: GOAL_REPLY_HOLD_MS },
    { session: goldSelected, holdMs: GOAL_SELECT_HOLD_MS },
    { session: mated, holdMs: 0 },
  ];
}

const goalFrames = listGoalFrames();
const lastStep = goalFrames.length - 1;

/**
 * 升の幅。スマートフォンでは例と同じ升にする。PC では、置き場所の幅に盤（5筋と淡く消える半升と縁）が収まり、
 * 高さに盤（4段と淡く消える半段と縁）・駒台・見せ直すボタンの段・遊び方の層が下に置くボタンの段が収まる大きさにし、例の升より大きくしない。
 */
const goalSquareClassName =
  "lg:[--tsume-shogi-figure-square:min(4rem,calc((100cqw-var(--tsume-shogi-goal-frame))/5.5),calc((100cqh-var(--tsume-shogi-goal-replay-row)-var(--how-to-play-goal-below,0px)-var(--komadai-height)-4px-var(--tsume-shogi-goal-frame))*352/386/4.5))]";

/** 升の幅を決めるのに使う、見せ直すボタンの段の高さと、盤の筋と段を書く縁のいちばん広い幅。 */
const goalSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--tsume-shogi-goal-replay-row": `${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px`,
  "--tsume-shogi-goal-frame": `${TSUME_SHOGI_FIGURE_LABELED_FRAME_MAX_PX}px`,
} as CSSProperties;

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から本番と同じ操作の姿で作意を指していき（飛を龍に成って王手し、
 * 玉が逃げ、金を打つ）、詰ませて本番の詰みの演出で終える。音は鳴らさない。
 * 指している途中に盤面を押すと、残りを飛ばして詰んだ姿をすぐ見せる。詰ませた後は見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、詰んだ盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const skipToGoal = useCallback(() => {
    setStep(lastStep);
    setSkipped(true);
    setSettled(true);
  }, []);
  // 詰みの演出は、受け取る関数が替わると始め直すので、同じ関数を渡し続ける。
  const finishClearing = useCallback(() => setSettled(true), []);

  // 指していく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled || skipped) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(window.setTimeout(skipToGoal, GOAL_START_HOLD_MS));
    } else {
      let elapsed = 0;
      for (let next = 1; next <= lastStep; next += 1) {
        elapsed += goalFrames[next - 1]?.holdMs ?? 0;
        timers.push(window.setTimeout(() => setStep(next), elapsed));
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled, skipped, skipToGoal]);

  function replay() {
    setStep(0);
    setSkipped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const session = goalFrames[step]?.session ?? goalFrames[0]!.session;
  const view = useTsumeShogiExampleView(session);
  const mated = session.status === "cleared";

  return (
    <div
      className={cn(
        "flex",
        tsumeShogiFigureSquareClassName,
        goalSquareClassName,
      )}
      style={goalSizeStyle}
    >
      <HowToPlayGoalFrame
        board={
          <div role="img" aria-label="ゴールの盤面">
            <div inert className="inline-flex flex-col gap-1">
              <TsumeShogiClearAnimation
                active={mated && !settled}
                onClearAnimationComplete={finishClearing}
              >
                <HowToPlayBoard
                  // 見せ直すたびに盤面を作り直し、指した駒の動きを始まりから見せる。
                  key={playCount}
                  crop={goalFigure.crop}
                  coordinates
                  boardPieces={view.boardPieces}
                  boardPieceIds={view.boardPieceIds}
                  selection={session.selection}
                  shownMoves={view.shownMoves}
                  shownMovesRestored={skipped}
                  promotionChoice={session.promotionChoice}
                  rejection={null}
                  mated={mated}
                />
              </TsumeShogiClearAnimation>
              <div className="h-(--komadai-height)">
                <TsumeShogiHand
                  hand={view.attackerHand}
                  selectedPieceType={
                    session.selection?.type === "hand"
                      ? session.selection.pieceType
                      : null
                  }
                  availability="available"
                  rejection={null}
                  onSelectHandPiece={ignoreHandPiece}
                />
              </div>
            </div>
          </div>
        }
        skippable={!settled}
        skipLabel="詰んだ姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

function ignoreHandPiece() {}

export const _private = {
  goalFrames,
  GOAL_START_HOLD_MS,
};
