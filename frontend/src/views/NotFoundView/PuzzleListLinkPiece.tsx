import { Link } from "@/router";

type PuzzleListLinkPieceProps = {
  /** セル部分の高さ。 */
  height: number;
  path: string;
  tabExtent: number;
  textScale: number;
  /** セル部分の幅。 */
  width: number;
  x: number;
  y: number;
};

// フォーカスリングが要素の外へはみ出さない余白。
const ringAllowance = 4;

export function PuzzleListLinkPiece({
  height,
  path,
  tabExtent,
  textScale,
  width,
  x,
  y,
}: PuzzleListLinkPieceProps) {
  const padding = tabExtent + ringAllowance;
  const boxWidth = width + padding * 2;
  const boxHeight = height + padding * 2;

  return (
    <Link
      to="/"
      // 押せる範囲をピースの形に合わせるため、リンク自体はポインタを受けずピースの塗りだけが受ける。
      className="group pointer-events-none absolute z-10 flex items-center justify-center outline-none"
      style={{
        height: boxHeight,
        left: x - padding,
        top: y - padding,
        width: boxWidth,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`${x - padding} ${y - padding} ${boxWidth} ${boxHeight}`}
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <path
          d={path}
          fill="none"
          className="stroke-ring/50 opacity-0 group-focus-visible:opacity-100"
          strokeWidth="6"
        />
        <path
          d={path}
          className="pointer-events-auto cursor-pointer fill-primary stroke-primary transition-colors duration-(--duration-fast) group-hover:fill-primary/90 group-hover:stroke-primary/90 motion-reduce:transition-none"
          strokeWidth="1"
        />
      </svg>
      <span
        className="relative text-body font-semibold text-primary-foreground"
        style={{
          fontSize: `calc(var(--text-body) * ${textScale})`,
          lineHeight: `calc(var(--text-body--line-height) * ${textScale})`,
        }}
      >
        パズル一覧へ戻る
      </span>
    </Link>
  );
}
