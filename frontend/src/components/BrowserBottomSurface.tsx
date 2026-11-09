type BrowserBottomSurfaceProps = {
  surface?: "page" | "game" | "brand";
};

const surfaceClassNames = {
  page: "bg-background",
  game: "bg-[var(--browser-surface,var(--background))]",
  brand: "bg-brand-inverse",
} satisfies Record<NonNullable<BrowserBottomSurfaceProps["surface"]>, string>;

/** Safariが全画面の固定枠から前の下端色を引き継がないよう、下端に独立した面を置く。 */
export function BrowserBottomSurface({
  surface = "page",
}: BrowserBottomSurfaceProps) {
  // WebKitの採色は10px以下の面を除くので、通常の余白3単位（12px）を確保する。
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none sticky bottom-0 z-20 h-3 shrink-0 ${surfaceClassNames[surface]}`}
    />
  );
}
