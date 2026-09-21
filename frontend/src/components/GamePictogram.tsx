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

export function GamePictogram({
  svg,
  variant = "default",
}: GamePictogramProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const parsedSvg = new DOMParser().parseFromString(
      svg,
      "image/svg+xml",
    ).documentElement;
    container.replaceChildren(document.importNode(parsedSvg, true));

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
