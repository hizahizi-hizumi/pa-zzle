import type { Ref } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSubduable } from "@/components/TutorialSubduable";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";

/** 盤面の幅を一辺のマス数で等分する。 */
const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

/** 印と応えは、タイルの面と同じ位置・同じ角丸で囲む。 */
const cuePlacementClassName =
  "pointer-events-none absolute inset-[1cqw] rounded-[1.6cqw]";

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  cue: SlidePuzzleTileCue | undefined;
  /** チュートリアルで手を引いている間、元の明るさで残すタイルのほかのタイルを一段沈める。 */
  subdued: boolean;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  cue,
  subdued,
  slideAnimated,
  faceRef,
  onPress,
}: SlidePuzzleTileProps) {
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer touch-manipulation select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        slideAnimated
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <TutorialSubduable subdued={subdued}>
        <SlidePuzzleTileFace tile={tile} boardSize={boardSize} ref={faceRef} />
      </TutorialSubduable>
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
