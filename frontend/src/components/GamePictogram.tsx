import { useEffect, useRef } from "react";

import { startShowcaseAtRest } from "@/components/game-pictogram-motion";
import { subscribePrefersReducedMotion } from "@/lib/motion";

type GamePictogramProps = {
  svg: string;
  variant?: "default" | "result";
  /**
   * `play` のとき、SVG が自身の `<style>` に持つ動きを、周の終わりの静止状態から再生させる。
   * 既定の `rest` では静止状態を見せる。
   */
  motion?: "rest" | "play";
};

const baseClassName =
  "block size-full font-sans [&>svg]:block [&>svg]:size-full";
const defaultColorClassName =
  "[--game-pictogram-soft:var(--muted-foreground)] [--game-pictogram-strong:var(--foreground)]";
const resultColorClassName =
  "[--game-pictogram-soft:color-mix(in_oklab,currentColor_55%,transparent)] [--game-pictogram-strong:currentColor]";

// 記録の一覧のように同じピクトグラムを多く並べても文字列を読み解き直さないよう、読み解いた SVG を使い回す。
const parsedSvgs = new Map<string, Element>();

function parseSvg(svg: string): Element {
  const cached = parsedSvgs.get(svg);
  if (cached) {
    return cached;
  }
  const parsed = new DOMParser().parseFromString(
    svg,
    "image/svg+xml",
  ).documentElement;
  parsedSvgs.set(svg, parsed);
  return parsed;
}

export function GamePictogram({
  svg,
  variant = "default",
  motion = "rest",
}: GamePictogramProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren(document.importNode(parseSvg(svg), true));
    if (motion !== "play") return () => container.replaceChildren();

    // 動きを減らす設定を戻すと動きが周の頭から作り直されるので、そのたびに静止状態から始め直す。
    function startAtRest() {
      if (container) startShowcaseAtRest(container);
    }
    startAtRest();
    const unsubscribe = subscribePrefersReducedMotion(startAtRest);
    return () => {
      unsubscribe();
      container.replaceChildren();
    };
  }, [svg, motion]);

  return (
    <span
      ref={containerRef}
      className={`${baseClassName} ${variant === "result" ? resultColorClassName : defaultColorClassName}`}
      data-pictogram-motion={motion === "play" ? "play" : undefined}
      aria-hidden="true"
    />
  );
}
