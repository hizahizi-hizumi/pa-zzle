import { useEffect, useRef } from "react";
import brandSymbolSvg from "@/assets/brand/pa-zzle-mark.svg?raw";

type BrandSymbolProps = {
  size: "default" | "compact";
};

const brandSymbolClassNames = {
  default: "h-[1.625rem]",
  compact: "h-4",
} satisfies Record<BrandSymbolProps["size"], string>;

export function BrandSymbol({ size }: BrandSymbolProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const parsedSvg = new DOMParser().parseFromString(
      brandSymbolSvg,
      "image/svg+xml",
    ).documentElement;
    container.replaceChildren(document.importNode(parsedSvg, true));

    return () => container.replaceChildren();
  }, []);

  return (
    <span
      ref={containerRef}
      className={`block shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-auto ${brandSymbolClassNames[size]}`}
      aria-hidden="true"
    />
  );
}
