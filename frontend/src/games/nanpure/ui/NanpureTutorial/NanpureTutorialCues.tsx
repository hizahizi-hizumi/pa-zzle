import type { CSSProperties } from "react";

import { NANPURE_BLOCK_SIZE, NANPURE_SIZE } from "@/games/nanpure/puzzle/board";
import type { NanpureTutorialUnit } from "@/games/nanpure/tutorial/tutorial";
import { cn } from "@/lib/utils";

/**
 * 行・列・ブロックに重ねる合図。
 * - `clue`: 次のマスの数字を決めるまとまりを、操作する前から示し続ける。
 * - `reason`: 入れた数字を決めたまとまりを、一瞬光らせる。
 */
export type NanpureTutorialUnitCue = {
  unit: NanpureTutorialUnit;
  kind: "clue" | "reason";
  id: number;
};

/**
 * マスに重ねる合図。
 * - `hint`: 次に選ぶマスを、出た瞬間から分かる強さで示す。`id` が変わるたびに一瞬光らせて付け直す。
 * - `fitted`: 手順のマスに解の数字を入れたことを、そのマスを一瞬光らせて示す。
 * - `rejected`: 受け付けなかったマスを、一瞬縁取って示す。
 */
export type NanpureTutorialCellCue = {
  cellIndex: number;
  kind: "hint" | "fitted" | "rejected";
  id: number;
};

type NanpureTutorialCuesProps = {
  unitCues: readonly NanpureTutorialUnitCue[];
  cellCues: readonly NanpureTutorialCellCue[];
};

function getUnitArea({ kind, index }: NanpureTutorialUnit): CSSProperties {
  switch (kind) {
    case "row":
      return {
        gridRow: `${index + 1}`,
        gridColumn: `1 / span ${NANPURE_SIZE}`,
      };
    case "column":
      return {
        gridRow: `1 / span ${NANPURE_SIZE}`,
        gridColumn: `${index + 1}`,
      };
    case "block":
      return {
        gridRow: `${Math.floor(index / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE + 1} / span ${NANPURE_BLOCK_SIZE}`,
        gridColumn: `${(index % NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE + 1} / span ${NANPURE_BLOCK_SIZE}`,
      };
  }
}

function getCellArea(cellIndex: number): CSSProperties {
  return {
    gridRow: `${Math.floor(cellIndex / NANPURE_SIZE) + 1}`,
    gridColumn: `${(cellIndex % NANPURE_SIZE) + 1}`,
  };
}

/** 光の合図は透明度だけで消し、動きを減らす設定でも見て分かるようにする。 */
const unitCueClassNames = {
  clue: "bg-sky-300/15 ring-[3px] ring-sky-500/80 ring-inset animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:bg-sky-400/10 dark:ring-sky-300/80",
  reason:
    "bg-sky-300/20 ring-[3px] ring-sky-500/60 ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in dark:bg-sky-400/15 dark:ring-sky-300/60",
} as const satisfies Record<NanpureTutorialUnitCue["kind"], string>;

const cellCueClassNames = {
  hint: "m-1 rounded-sm border-[3px] border-sky-600 border-dashed dark:border-sky-400",
  fitted:
    "m-1 rounded-sm bg-sky-200/50 ring-2 ring-sky-500/60 ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in dark:bg-sky-800/40 dark:ring-sky-300/60",
  rejected:
    "ring-[3px] ring-destructive ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in",
} as const satisfies Record<NanpureTutorialCellCue["kind"], string>;

/**
 * 盤面の上に重ねる、チュートリアルの合図。盤面のマスと同じ 9×9 の格子に置き、押す操作は下の盤面へ通す。
 * 盤面の外枠の太さぶん内側に置き、マスの位置にそろえる。
 */
export function NanpureTutorialCues({
  unitCues,
  cellCues,
}: NanpureTutorialCuesProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0.5 grid grid-cols-9 grid-rows-9"
    >
      {unitCues.map((cue) => (
        <span
          key={`${cue.kind}:${cue.unit.kind}:${cue.unit.index}:${cue.id}`}
          data-unit-cue={cue.kind}
          data-unit={`${cue.unit.kind}:${cue.unit.index}`}
          className={cn("rounded-sm", unitCueClassNames[cue.kind])}
          style={getUnitArea(cue.unit)}
        />
      ))}
      {cellCues.map((cue) => (
        <span
          key={`${cue.kind}:${cue.cellIndex}:${cue.id}`}
          data-cell-cue={cue.kind}
          data-cell-index={cue.cellIndex}
          className={cn("relative", cellCueClassNames[cue.kind])}
          style={getCellArea(cue.cellIndex)}
        >
          {cue.kind === "hint" && (
            <span className="absolute inset-0 bg-sky-200/80 fill-mode-forwards animate-out fade-out-0 duration-700 ease-in dark:bg-sky-800/70" />
          )}
        </span>
      ))}
    </div>
  );
}
