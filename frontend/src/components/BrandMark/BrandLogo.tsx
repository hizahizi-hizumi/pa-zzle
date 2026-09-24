import { useEffect, useRef } from "react";
import logoInlineSvg from "@/assets/brand/pa-zzle-logo-inline.svg?raw";
import logoStackedSvg from "@/assets/brand/pa-zzle-logo-stacked.svg?raw";

type BrandLogoProps = {
  size: "default" | "compact";
};

type BrandLogoArtwork = {
  svg: string;
  heightClassName: string;
};

// 小さいヘッダーでは2段組の下段が潰れるため、1行の版に切り替える
const brandLogoArtworks = {
  default: { svg: logoStackedSvg, heightClassName: "h-[1.625rem]" },
  compact: { svg: logoInlineSvg, heightClassName: "h-4" },
} satisfies Record<BrandLogoProps["size"], BrandLogoArtwork>;

export function BrandLogo({ size }: BrandLogoProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const { svg, heightClassName } = brandLogoArtworks[size];

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
