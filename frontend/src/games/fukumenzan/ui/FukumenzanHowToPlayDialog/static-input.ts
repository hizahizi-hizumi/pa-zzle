import type { FukumenzanInputHandlers } from "@/games/fukumenzan/ui/board/use-fukumenzan-input";

function ignore() {}

const staticHandlers: FukumenzanInputHandlers = {
  onPointerDown: ignore,
  onPointerMove: ignore,
  onPointerUp: ignore,
  onPointerCancel: ignore,
  onClick: ignore,
};

/** 押せない図とゴールの盤面の文字と札。押しても何も起きない。 */
export function getStaticLetterHandlers(): FukumenzanInputHandlers {
  return staticHandlers;
}

export function ignoreFigureEvent(): void {}
