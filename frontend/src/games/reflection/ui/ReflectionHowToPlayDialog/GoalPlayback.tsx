import { type CSSProperties, useCallback, useEffect, useState } from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import type { GameProgress } from "@/games/play";
import type { ReflectionBoard as ReflectionBoardState } from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import { getReflectionFigureExtent } from "@/games/reflection/ui/board/board-geometry";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { goalFigure } from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import {
  getReflectionFigureSide,
  reflectionGoalUnitMaxClassName,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-size";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。外周の数字と、最初から合っている数字を読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 900;

/** ピースを1つずつ置く間。置いたピースが現れ、合った数字が緑になるのを1つずつ追える長さにする。 */
const GOAL_PLACE_INTERVAL_MS = 550;

const { solution, order } = goalFigure;
const clues = computeReflectionClues(solution);
const pieceCount = order.length;

/** 空の盤面から、`order` の順に `count` 個のピースを置いた盤面。 */
function placeGoalPieces(count: number): ReflectionBoardState {
  const placed = new Set<number>(order.slice(0, count));
  return {
    size: solution.size,
    cells: solution.cells.map((cell, cellIndex) =>
      placed.has(cellIndex) ? cell : null,
    ),
  };
}

/**
 * 盤面のマスの大きさ。置き場所の幅と、遊び方の層が渡す上限と、高さ（広い画面で渡される）から見せ直すボタンの段と
 * 遊び方の層が盤面の下に置くボタンの段を除いた高さの小さい方に、外周の数字の帯を含めた盤面を合わせ、例のマスより大きくしない。
 */
const goalSizeStyle = {
  "--reflection-figure-unit": `min(calc(min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) / ${getReflectionFigureExtent(solution.size)}), var(--reflection-goal-unit-max))`,
} as CSSProperties;

function ignoreBoardPress() {}

/**
 * 入口のゴールの盤面。本番の盤面部品に、置いていく途中の盤面と進み具合（`GameProgress`）を渡し、ピースの現れ方・一致の地・
 * 完成の演出を本番の部品に描かせる。音のフックは使わない。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState<GameProgress>("playing");
  const settled = progress === "result";

  // 置いていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setCount(pieceCount);
          setProgress("result");
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 1; next <= pieceCount; next += 1) {
        timers.push(
          window.setTimeout(
            () => {
              setCount(next);
              if (next === pieceCount) {
                setProgress("clearing");
              }
            },
            GOAL_START_HOLD_MS + (next - 1) * GOAL_PLACE_INTERVAL_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled]);

  const finishClearing = useCallback(() => setProgress("result"), []);

  function skipToGoal() {
    setCount(pieceCount);
    setProgress("result");
  }

  function replay() {
    setCount(0);
    setProgress("playing");
    setPlayCount((current) => current + 1);
  }

  const board = placeGoalPieces(count);
  const side = getReflectionFigureSide(solution.size);
  return (
    <div className={reflectionGoalUnitMaxClassName} style={goalSizeStyle}>
      <HowToPlayGoalFrame
        board={
          <div
            role="img"
            aria-label="ゴールの盤面"
            className="relative"
            style={{ width: side, height: side }}
          >
            <ReflectionBoard
              board={board}
              clues={clues}
              clueMatches={listReflectionClueMatches(board, clues)}
              selection={null}
              laser={null}
              interactionDisabled
              progress={progress}
              onSelectCell={ignoreBoardPress}
              onSelectClue={ignoreBoardPress}
              onRemovePiece={ignoreBoardPress}
              onClearAnimationComplete={finishClearing}
            />
          </div>
        }
        skippable={!settled}
        skipLabel="置き終えた姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_PLACE_INTERVAL_MS,
  placeGoalPieces,
};
