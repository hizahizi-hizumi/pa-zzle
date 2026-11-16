import type { CSSProperties, KeyboardEvent } from "react";

import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard as IceFloorMazeBoardState,
} from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { findArrowKeyDirection } from "@/games/ice-floor-maze/ui/arrow-key-direction";
import { ICE_FLOOR_MAZE_WALL_THICKNESS } from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import {
  getIceFloorMazeFigureSizeStyle,
  iceFloorMazeFigureCellClassNames,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-size";
import { SwipeHint } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/TouchableExample/HowToPlayBoard/SwipeHint";
import {
  IceFloorMazeSwipeArea,
  SWIPE_START_TARGET_ATTRIBUTE,
} from "@/games/ice-floor-maze/ui/IceFloorMazeSwipeArea";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  board: IceFloorMazeBoardState;
  state: IceFloorMazeState;
  goal: number | null;
  lastSlide: IceFloorMazeLastSlide | null;
  blockedInput: IceFloorMazeBlockedInput | null;
  clearing: boolean;
  /** ゴールで止まった後は `false` にし、本番と同じく受け付けない。 */
  playing: boolean;
  /** 次に滑らせる向きの手がかりと、その向きへ1マスも動けないか。付けないときは `null`。 */
  hint: { direction: IceFloorMazeDirection; blocked: boolean } | null;
  onSlide: (direction: IceFloorMazeDirection) => void;
  onClearAnimationComplete: () => void;
};

/** 指でスワイプを始められる所の、いちばん小さい一辺。指で始めやすい大きさにする。 */
const SWIPE_START_MIN_PX = 44;

/**
 * 駒のマスの中央を中心に、マスの大きさ（44px を下回るなら 44px）の正方形で、指でスワイプを始められる所を置く。
 * 盤面は外壁の厚さの分だけ内側から始まるので、その分をずらす。
 */
function getSwipeStartStyle(
  board: IceFloorMazeBoardState,
  position: number,
): CSSProperties {
  const { x, y } = getIceFloorMazeCellPosition(board, position);
  const side = `max(var(--ice-floor-maze-figure-cell), ${SWIPE_START_MIN_PX}px)`;
  return {
    left: `calc(var(--ice-floor-maze-figure-cell) * ${x + 0.5 + ICE_FLOOR_MAZE_WALL_THICKNESS})`,
    top: `calc(var(--ice-floor-maze-figure-cell) * ${y + 0.5 + ICE_FLOOR_MAZE_WALL_THICKNESS})`,
    width: side,
    height: side,
    transform: "translate(-50%, -50%)",
  };
}

/** 盤面は滑りの間の動きを自分で描くので、例は滑っている間を待たない。 */
function ignoreSlideAnimationActivity(): void {}

/**
 * 触れる例の盤面。本番の盤面部品と、本番と同じスワイプの受け方をそのまま使い、滑る・止まる・崩れる・割れる・押し出す・押し戻されるの
 * 動きを本番と同じにする。マスは、ゴールの盤面のマスと同じ物に見える大きさ（`iceFloorMazeFigureCellClassNames.example`）で描く。
 * 本番のプレイ画面は矢印キーを画面のどこでも受けるが、遊び方では矢印キーで中身を送るので、例は Tab で選んだときだけ矢印キーを受ける。
 * 次に滑らせる向きの手がかりは、盤面と同じ座標で、盤面の上に重ねる。
 * 遊び方は指で送る画面なので、指のスワイプは駒のマスから始めたときだけ受け、スクロールを止めるのもそこだけにする。
 * 盤面のほかの所に指を置いて縦に動かすと、層を送れる。マウスとペンは本番と同じく盤面のどこからでも受ける。
 */
export function HowToPlayBoard({
  board,
  state,
  goal,
  lastSlide,
  blockedInput,
  clearing,
  playing,
  hint,
  onSlide,
  onClearAnimationComplete,
}: HowToPlayBoardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const direction = findArrowKeyDirection(event.key);
    if (
      !direction ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    // 押し続けたときの繰り返しは、本番と同じく滑らせない。
    if (playing && !event.repeat) {
      onSlide(direction);
    }
  }

  return (
    <div
      role="group"
      aria-label="盤面"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex shrink-0 flex-col rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:outline-solid",
        iceFloorMazeFigureCellClassNames.example,
      )}
      style={getIceFloorMazeFigureSizeStyle(board)}
    >
      <IceFloorMazeSwipeArea
        disabled={!playing}
        onSwipe={onSlide}
        touchArea="start-targets"
      >
        <IceFloorMazeBoard
          board={board}
          cells={state.cells}
          blocks={state.blocks}
          goal={goal}
          position={state.position}
          lastSlide={lastSlide}
          blockedInput={blockedInput}
          clearing={clearing}
          onSlideAnimationActivityChange={ignoreSlideAnimationActivity}
          onClearAnimationComplete={onClearAnimationComplete}
        />
        <span
          aria-hidden="true"
          {...{ [SWIPE_START_TARGET_ATTRIBUTE]: "" }}
          className="absolute touch-none"
          style={getSwipeStartStyle(board, state.position)}
        />
      </IceFloorMazeSwipeArea>
      {hint === null ? null : (
        <SwipeHint
          board={board}
          position={state.position}
          direction={hint.direction}
          blocked={hint.blocked}
        />
      )}
    </div>
  );
}
