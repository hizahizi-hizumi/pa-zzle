import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import {
  areNanpureCellsRelated,
  NANPURE_SIZE,
  type NanpureBoard as NanpureBoardState,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import type { NanpureBoardSpotlight } from "@/games/nanpure/ui/board/board-spotlight";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureUnitSpotlight } from "@/games/nanpure/ui/board/NanpureBoard/NanpureUnitSpotlight";
import { NanpureCell } from "@/games/nanpure/ui/board/NanpureCell";
import { cn } from "@/lib/utils";

const NANPURE_CELL_INDICES = Array.from(
  { length: NANPURE_SIZE * NANPURE_SIZE },
  (_, cellIndex) => cellIndex,
);

type NanpureBoardProps = {
  board: NanpureBoardState;
  clues: NanpureBoardState;
  notes: NanpureNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  interactionDisabled?: boolean;
  /** 盤面の幅。渡さなければ、プレイ画面に合わせて画面の幅と高さから決める。 */
  sizeClassName?: string;
  cues?: readonly NanpureCellCue[];
  /** チュートリアルで、盤面の覆いから抜く所。渡している間、盤面を覆う範囲として示す。`null` なら覆わない。 */
  spotlight?: NanpureBoardSpotlight | null;
  onSelectCell: (cellIndex: number) => void;
};

export function NanpureBoard({
  board,
  clues,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  interactionDisabled = false,
  sizeClassName = "w-[min(96vw,calc(100svh-12rem),38rem)]",
  cues = [],
  spotlight = null,
  onSelectCell,
}: NanpureBoardProps) {
  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));
  const spotlitCells = new Set(spotlight?.cellIndices);
  const conflictCells = new Set(conflictCellIndices);
  const mistakeCells = new Set(mistakeCellIndices);
  const selectedValue =
    selectedCellIndex === null ? null : (board[selectedCellIndex] ?? null);

  return (
    // マスの数字の大きさを盤面の幅で抑え、狭く置いた盤面でも数字がマスに収まるようにする。
    <div
      {...(spotlight !== null && { [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "" })}
      className={cn(
        "relative grid aspect-square grid-cols-9 overflow-hidden border-2 border-foreground/55 bg-background [container-type:inline-size]",
        sizeClassName,
      )}
    >
      {NANPURE_CELL_INDICES.map((cellIndex) => {
        const value = board[cellIndex] ?? null;
        const selected = selectedCellIndex === cellIndex;
        const sameUnitAsSelected =
          selectedCellIndex !== null &&
          !selected &&
          areNanpureCellsRelated(selectedCellIndex, cellIndex);

        return (
          <NanpureCell
            key={cellIndex}
            cellIndex={cellIndex}
            value={value}
            clue={clues[cellIndex] !== null}
            notes={notes[cellIndex] ?? []}
            selectedValue={selectedValue}
            selected={selected}
            sameUnitAsSelected={sameUnitAsSelected}
            sameDigitAsSelected={
              selectedValue !== null && !selected && value === selectedValue
            }
            conflict={conflictCells.has(cellIndex)}
            mistake={mistakeCells.has(cellIndex)}
            disabled={interactionDisabled}
            cue={cueByCellIndex.get(cellIndex)}
            spotlit={spotlitCells.has(cellIndex)}
            onSelect={onSelectCell}
          />
        );
      })}
      {spotlight?.units.map((unit) => (
        <NanpureUnitSpotlight key={`${unit.kind}:${unit.index}`} unit={unit} />
      ))}
    </div>
  );
}
