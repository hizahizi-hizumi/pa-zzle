import { type RefObject, useEffect, useRef, useState } from "react";

/** ゲームのホームで開く層。チュートリアルは遊び方の中から、ほかは見出しのメニューから開く。 */
export type GameHomeLayer =
  | "howToPlay"
  | "tutorial"
  | "legend"
  | "filter"
  | "performance";

export type GameHomeLayerControl = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 層を寄せて出す、メニューのボタン。 */
  anchorRef: RefObject<HTMLButtonElement | null>;
};

type GameHomeLayers = {
  openLayer: GameHomeLayer | null;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  changeLayerOpen: (layer: GameHomeLayer, open: boolean) => void;
};

/** 閉じた層の中か、行き先を失った位置にあるフォーカス。層の外の要素を押して閉じたときは、押した要素から動かさない。 */
function isFocusLeftByLayer(): boolean {
  const active = document.activeElement;
  return (
    active === null ||
    active === document.body ||
    active.closest('[role="dialog"]') !== null
  );
}

/**
 * 見出しのメニューから開く層を1つずつ開き、閉じたらメニューのボタンへフォーカスを戻す。
 * 層はメニューのボタンを引き金として持たず、閉じても自分ではフォーカスを戻さないので、閉じた姿を描いたあとに戻す。
 */
export function useGameHomeLayers(): GameHomeLayers {
  const [openLayer, setOpenLayer] = useState<GameHomeLayer | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const returnsFocusRef = useRef(false);

  useEffect(() => {
    if (openLayer === null && returnsFocusRef.current) {
      returnsFocusRef.current = false;
      if (isFocusLeftByLayer()) {
        menuButtonRef.current?.focus();
      }
    }
  }, [openLayer]);

  function changeLayerOpen(layer: GameHomeLayer, open: boolean) {
    if (open) {
      setOpenLayer(layer);
      return;
    }
    returnsFocusRef.current = true;
    setOpenLayer((current) => (current === layer ? null : current));
  }

  return { openLayer, menuButtonRef, changeLayerOpen };
}
