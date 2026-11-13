import { useCallback } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { takuzuCellSurfaceClassName } from "@/games/takuzu/ui/board/board-surface-style";
import { getTakuzuCellAccessibleName } from "@/games/takuzu/ui/board/cell-accessible-name";
import { takuzuCellButtonClassName } from "@/games/takuzu/ui/board/cell-button-style";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { useTakuzuCellSecondaryClick } from "@/games/takuzu/ui/board/use-cell-secondary-click";
import { runViolationCellClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import { violationMarkTimingClassName } from "@/games/takuzu/ui/board/violation-mark-timing";
import { cn } from "@/lib/utils";

type TakuzuCellProps = {
  size: number;
  cellIndex: number;
  view: TakuzuCellView;
  lineViolationNames: readonly string[];
  disabled: boolean;
  /** 揺れの合図は盤面が掛けるので、マスは印と応えだけを描く。 */
  cue: TakuzuCellCue | undefined;
  spotlit: boolean;
  focusable: boolean;
  onElementChange: (
    cellIndex: number,
    element: HTMLButtonElement | null,
  ) => void;
  onCycle: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onFocus: (cellIndex: number) => void;
};

/** 印と応えの線は、隣り合うマスの線と重ならないよう、マスの縁から少し内側に、角の立ったマスの形で引く。 */
const cueOutlinePlacementClassName = "pointer-events-none absolute inset-1";

export function TakuzuCell({
  size,
  cellIndex,
  view,
  lineViolationNames,
  disabled,
  cue,
  spotlit,
  focusable,
  onElementChange,
  onCycle,
  onFocus,
}: TakuzuCellProps) {
  const { handlePointerDown, handleContextMenu } =
    useTakuzuCellSecondaryClick();
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(cellIndex, element),
    [cellIndex, onElementChange],
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={getTakuzuCellAccessibleName(
        { row, column },
        view,
        lineViolationNames,
      )}
      aria-disabled={view.given || undefined}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onCycle(cellIndex, "forward")}
      onContextMenu={(event) =>
        handleContextMenu(event, () => {
          if (!disabled) {
            onCycle(cellIndex, "backward");
          }
        })
      }
      onPointerDown={handlePointerDown}
      onFocus={() => onFocus(cellIndex)}
      data-violated={view.inViolatingRun || undefined}
      className={cn(
        "group relative flex min-h-0 min-w-0 items-center justify-center",
        takuzuCellButtonClassName,
        takuzuCellSurfaceClassName,
        row !== size - 1 && "border-b border-b-border",
        column !== size - 1 && "border-r border-r-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0",
          violationMarkTimingClassName,
          runViolationCellClassName,
        )}
      />
      <TutorialSpotlight active={spotlit} className="inset-0" />
      {cue?.kind === "fitted" && (
        <span
          aria-hidden="true"
          data-cell-cue={cue.kind}
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue kind="acknowledgement" id={cue.id} />
        </span>
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-cell-cue="hint"
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue
            kind="mark"
            recallId={cue.kind === "recall" ? cue.id : null}
          />
        </span>
      )}
      {/*
        固定マスを押したときの揺れと完成の波は、格子を崩さないよう中のタイルだけに掛ける。
        タイルは常に独立した合成レイヤーに置く。動くときだけレイヤーに上がると、後ろに描くマスがまとめて
        レイヤーに分け直され、ほかのタイルが小数ピクセルずれて描き直されるため、動きの始まりと終わりに盤面全体が揺れて見える。
        固定か置いたものかは、チュートリアルの導入で置いたタイルだけを消して始めの盤面へ戻すのに使う。
      */}
      <span
        data-takuzu-tile={view.given ? "given" : "placed"}
        data-clear-wave-step={row + column}
        className="relative size-[80%] will-change-transform"
      >
        <TakuzuCellFace
          key={view.cell}
          cell={view.cell}
          given={view.given}
          size="board"
        />
      </span>
    </button>
  );
}
