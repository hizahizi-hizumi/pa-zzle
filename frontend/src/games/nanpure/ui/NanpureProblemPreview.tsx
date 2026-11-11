import type { NanpureProblem } from "@/games/nanpure/problem/problem";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";

type NanpureProblemPreviewProps = {
  problem: NanpureProblem;
};

function ignoreCellSelection() {}

/** 1問の、始めたときの盤面。プレイ画面と同じ盤面を、置かれた枠に縦横比を保って収まる最大の大きさで描く。操作は受けない。 */
export function NanpureProblemPreview({ problem }: NanpureProblemPreviewProps) {
  return (
    <NanpureBoard
      board={problem.clues}
      clues={problem.clues}
      notes={[]}
      selectedCellIndex={null}
      conflictCellIndices={[]}
      mistakeCellIndices={[]}
      interactionDisabled
      sizeClassName="w-[min(100cqw,100cqh)]"
      onSelectCell={ignoreCellSelection}
    />
  );
}
