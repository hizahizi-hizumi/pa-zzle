import { useEffect, useRef } from "react";

type GamePictogramProps = {
  svg: string;
  variant?: "default" | "result";
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
}: GamePictogramProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren(document.importNode(parseSvg(svg), true));

    return () => container.replaceChildren();
  }, [svg]);

  return (
    <span
      ref={containerRef}
      className={`${baseClassName} ${variant === "result" ? resultColorClassName : defaultColorClassName}`}
      aria-hidden="true"
    />
  );
}
