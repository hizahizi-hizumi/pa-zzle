import { type PointerEvent, type Ref, useRef } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { SlidePuzzleTileDirection } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { getSlidePuzzleSwipeDirection } from "@/games/slide-puzzle/ui/board/tile-swipe";

export const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

export const tileFaceShapeClassName = "inset-[1cqw] rounded-[1.6cqw]";

const cuePlacementClassName = `pointer-events-none absolute ${tileFaceShapeClassName}`;

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  cue: SlidePuzzleTileCue | undefined;
  spotlit: boolean;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
  onSwipe: (cellIndex: number, direction: SlidePuzzleTileDirection) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  cue,
  spotlit,
  slideAnimated,
  faceRef,
  onPress,
  onSwipe,
}: SlidePuzzleTileProps) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
        // 指がタイルの外へ出てから離しても、押し始めたタイルのスワイプとして受ける。
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        const direction =
          start &&
          getSlidePuzzleSwipeDirection(
            event.clientX - start.x,
            event.clientY - start.y,
          );
        if (direction) {
          swiped.current = true;
          onSwipe(cellIndex, direction);
        }
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClick={() => {
        // スワイプとして受けた指を離したときのクリックは、タップとして重ねない。
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        onPress(cellIndex);
      }}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer touch-none select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        slideAnimated
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <SlidePuzzleTileFace tile={tile} boardSize={boardSize} ref={faceRef} />
      <TutorialSpotlight active={spotlit} className={tileFaceShapeClassName} />
      {cue?.kind === "landed" && (
        <span
          aria-hidden="true"
          data-tile-cue={cue.kind}
          className={cuePlacementClassName}
        >
          <TutorialCue kind="acknowledgement" id={cue.id} />
        </span>
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-tile-cue="hint"
          className={cuePlacementClassName}
        >
          <TutorialCue
            kind="mark"
            recallId={cue.kind === "recall" ? cue.id : null}
          />
        </span>
      )}
    </button>
  );
}
