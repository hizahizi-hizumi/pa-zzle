import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useRef,
} from "react";

import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuTile } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell/TakuzuTile";

type TakuzuCellProps = {
  size: number;
  cellIndex: number;
  view: TakuzuCellView;
  disabled: boolean;
  focusable: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onPress: (cellIndex: number) => void;
  onPressBackward: (cellIndex: number) => void;
  onFocus: (cellIndex: number) => void;
};

const tileNameByCell = { a: "A", b: "B" } as const;

/**
 * ルール違反のマスの印。縁の実線と、タイルの上に重ねる斜線で示し、色だけに頼らない。
 * 行・列がすべて埋まっていても違反の範囲が読めるよう、斜線はタイルより前に置く。
 * 共通の `error` 色ではなく、盤面の中だけで使うゲーム固有の色にする。
 */
const violationMarkClassName =
  "rounded-[inherit] bg-[repeating-linear-gradient(135deg,rgb(244_63_94/0.55)_0_2px,transparent_2px_7px)] shadow-[inset_0_0_0_2px_var(--color-rose-500)] dark:bg-[repeating-linear-gradient(135deg,rgb(251_113_133/0.5)_0_2px,transparent_2px_7px)] dark:shadow-[inset_0_0_0_2px_var(--color-rose-400)]";

// 巡回で B へ進む途中の A が一瞬だけ違反になっても印がちらつかないよう、印は少し遅れて出す。消すときは待たない。
const violationMarkTimingClassName =
  "opacity-0 transition-opacity duration-0 group-data-violated:opacity-100 group-data-violated:delay-[240ms] group-data-violated:duration-(--duration-normal) motion-reduce:group-data-violated:duration-0";

function getAccessibleName(
  size: number,
  cellIndex: number,
  view: TakuzuCellView,
): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const content = view.cell === null ? "空き" : tileNameByCell[view.cell];
  const qualifiers = [
    view.given ? "固定" : null,
    view.violated ? "ルール違反" : null,
  ].filter((qualifier) => qualifier !== null);
  return [`${row + 1}行${column + 1}列`, content, ...qualifiers].join(" ");
}

export function TakuzuCell({
  size,
  cellIndex,
  view,
  disabled,
  focusable,
  buttonRef,
  onPress,
  onPressBackward,
  onFocus,
}: TakuzuCellProps) {
  const lastPointerTypeRef = useRef<string | null>(null);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    lastPointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    // タッチの長押しでも contextmenu が届く環境があるため、逆方向の巡回はマウスの右クリックに限る。
    if (!disabled && lastPointerTypeRef.current !== "touch") {
      onPressBackward(cellIndex);
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={getAccessibleName(size, cellIndex, view)}
      aria-disabled={view.given || undefined}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onPress(cellIndex)}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onFocus={() => onFocus(cellIndex)}
      data-violated={view.violated || undefined}
      className="group relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center rounded-[10%] bg-slate-200 shadow-[inset_0_1px_2px_rgb(15_23_42/0.14)] transition-transform duration-(--duration-fast) focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default enabled:not-aria-disabled:active:scale-[0.94] enabled:not-aria-disabled:hover:bg-slate-300/80 motion-reduce:transition-none motion-reduce:enabled:not-aria-disabled:active:scale-100 dark:bg-slate-800 dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)] dark:enabled:not-aria-disabled:hover:bg-slate-700/80"
    >
      {view.cell !== null ? (
        <TakuzuTile key={view.cell} tile={view.cell} given={view.given} />
      ) : null}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${violationMarkTimingClassName} ${violationMarkClassName}`}
      />
    </button>
  );
}
