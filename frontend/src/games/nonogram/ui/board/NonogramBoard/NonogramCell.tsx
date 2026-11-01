import { type MouseEvent as ReactMouseEvent, useCallback } from "react";

import type { NonogramCellState } from "@/games/nonogram/puzzle/board";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramCellProps = {
  cellIndex: number;
  row: number;
  column: number;
  state: NonogramCellState;
  /** クリアして図柄を見せている。× を消す。 */
  revealed: boolean;
  disabled: boolean;
  focusable: boolean;
  onElementChange: (
    cellIndex: number,
    element: HTMLButtonElement | null,
  ) => void;
  /** マスを押した。指やマウスの押下は盤面が受けるので、キーボードからの押下でだけ呼ぶ。 */
  onPressCell: (cellIndex: number) => void;
  onFocus: (cellIndex: number, focusVisible: boolean) => void;
};

const stateNames = {
  unknown: "未確定",
  filled: "塗り",
  crossed: "バツ",
} as const satisfies Record<NonogramCellState, string>;

/**
 * クリア後の塗り。隣の塗りへ半画素ずつ重ね、図柄を膨らませる途中でも塗りの間に地の色の細い線を出さない。
 */
const revealedFillClassName = "inset-[-0.5px]";

export function NonogramCell({
  cellIndex,
  row,
  column,
  state,
  revealed,
  disabled,
  focusable,
  onElementChange,
  onPressCell,
  onFocus,
}: NonogramCellProps) {
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(cellIndex, element),
    [cellIndex, onElementChange],
  );

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    // 指やマウスで押した入力は盤面が pointer で受ける。click で受けるのは、`detail` が 0 のキーボードからの押下だけ。
    if (event.detail === 0) {
      onPressCell(cellIndex);
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      data-cell-index={cellIndex}
      aria-label={`${row + 1}行${column + 1}列 ${stateNames[state]}`}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={handleClick}
      onFocus={(event) =>
        onFocus(cellIndex, event.currentTarget.matches(":focus-visible"))
      }
      className={cn(
        "relative min-h-0 min-w-0 select-none outline-none enabled:hover:bg-accent focus-visible:z-[2] focus-visible:outline-2 focus-visible:-outline-offset-2",
        nonogramToneClassNames.focusOutline,
      )}
    >
      <span
        data-nonogram-clear-fade={state === "crossed" || undefined}
        className={cn(
          "pointer-events-none absolute inset-0",
          revealed && state === "crossed" && "opacity-0",
          revealed && state === "filled" && revealedFillClassName,
        )}
      >
        <NonogramCellFace state={state} />
      </span>
    </button>
  );
}
