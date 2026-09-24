import { useEffect, useRef } from "react";
import logoInlineSvg from "@/assets/brand/pa-zzle-logo-inline.svg?raw";
import logoStackedSvg from "@/assets/brand/pa-zzle-logo-stacked.svg?raw";
import logotypeInlineSvg from "@/assets/brand/pa-zzle-logotype-inline.svg?raw";

type BrandLogoProps = {
  content: "symbol-and-name" | "name";
  size: "default" | "compact";
};

type BrandLogoArtwork = {
  svg: string;
  heightClassName: string;
};

// 小さいヘッダーでは2段組の下段が潰れるため、1行の版に切り替える
const brandLogoArtworks = {
  "symbol-and-name": {
    default: { svg: logoStackedSvg, heightClassName: "h-[1.625rem]" },
    compact: { svg: logoInlineSvg, heightClassName: "h-4" },
  },
  name: {
    default: { svg: logotypeInlineSvg, heightClassName: "h-3.5" },
    compact: { svg: logotypeInlineSvg, heightClassName: "h-[11px]" },
  },
} satisfies Record<
  BrandLogoProps["content"],
  Record<BrandLogoProps["size"], BrandLogoArtwork>
>;

export function BrandLogo({ content, size }: BrandLogoProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const { svg, heightClassName } = brandLogoArtworks[content][size];

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
      className={`block shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-auto ${heightClassName}`}
      aria-hidden="true"
    />
  );
}
