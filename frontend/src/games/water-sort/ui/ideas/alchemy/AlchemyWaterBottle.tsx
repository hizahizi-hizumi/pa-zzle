import { useLayoutEffect, useRef, useState } from "react";

import { AlchemyFlask } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask";
import { getFlaskShape } from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";
import { isSealedBottle } from "@/games/water-sort/ui/ideas/alchemy/sealed-bottle";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";

/**
 * 盤面のフラスコ。形はボトルの番号で決めるが、番号は受け取らないので、置かれた盤面のボタンの並びから読む。
 * 注ぐ演出の器は `AlchemyPourLayer` が番号を知って描く。
 */
export function AlchemyWaterBottle({
  contents,
  selected = false,
  waterOverlay,
  concealed = false,
}: WaterBottleProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [bottleIndex, setBottleIndex] = useState(0);
  const complete = isSealedBottle(contents);
  // 初めから封をしていたフラスコは、灯って封をする動きを見せない。
  const [sealedWithoutCeremony, setSealedWithoutCeremony] = useState(complete);
  if (!complete && sealedWithoutCeremony) {
    setSealedWithoutCeremony(false);
  }

  useLayoutEffect(() => {
    const button = anchorRef.current?.closest(
      "[data-water-sort-board] > button",
    );
    const siblings = button?.parentElement?.children;
    if (button && siblings) {
      setBottleIndex(Array.prototype.indexOf.call(siblings, button));
    }
  }, []);

  return (
    <span ref={anchorRef} aria-hidden="true" className="absolute inset-0">
      <AlchemyFlask
        contents={contents}
        shape={getFlaskShape(bottleIndex)}
        selected={selected}
        // 注いでいる間は注ぐ演出が器を描くので、注ぎ終えて姿を現したときに封をする。
        sealed={complete && !concealed}
        animateSealing={!sealedWithoutCeremony}
        liquidOverlay={waterOverlay}
      />
    </span>
  );
}
