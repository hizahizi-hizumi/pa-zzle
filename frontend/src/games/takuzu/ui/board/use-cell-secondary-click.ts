import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";

export type TakuzuCellSecondaryClick = {
  /** マスの `onPointerDown` に渡し、押した入力の種類を覚える。 */
  handlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** マスの `onContextMenu` から呼び、マウスの右クリックのときだけ `onSecondaryClick` を呼ぶ。 */
  handleContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    onSecondaryClick: () => void,
  ) => void;
};

/** マスの右クリックを、逆の向きに巡らせる操作として受ける。 */
export function useTakuzuCellSecondaryClick(): TakuzuCellSecondaryClick {
  const lastPointerTypeRef = useRef<string | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>): void {
    lastPointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    onSecondaryClick: () => void,
  ): void {
    event.preventDefault();
    // タッチの長押しでも contextmenu が届く環境があるため、マウスの右クリックに限る。
    if (lastPointerTypeRef.current !== "touch") {
      onSecondaryClick();
    }
  }

  return { handlePointerDown, handleContextMenu };
}
