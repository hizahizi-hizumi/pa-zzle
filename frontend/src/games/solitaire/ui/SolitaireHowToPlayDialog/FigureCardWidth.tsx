import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * 遊び方の図の札の幅の決め方。
 * - `example`: ルールと操作の例。スマートフォンで本番の札（幅 390px の画面で約 50px）と同じ物に見える大きさにする。
 * - `goal`: 入口のゴールの盤面。4つの山と間（3 × 4px）と卓の地の縁（2 × 8px）が置き場所の幅に収まる大きさにし、例の札より大きくしない。
 * - `flowFrame`: 採点の流れの図のコマ。2つの山の姿3つと矢印2つが面に収まる大きさにし、例の札より大きくしない。
 *   矢印の名前は3文字までの行なので、矢印のまとまり2つ（2 × 42px）と間（4 × 8px）で 7.25rem を取る。
 *   コマ3つの中の山の間（3 × 4px）と、詰めた卓の地の縁（6 × 4px）で 36px を取る。
 */
export type SolitaireFigureCardSize = "example" | "goal" | "flowFrame";

const exampleCardWidth =
  "[--solitaire-example-card:--spacing(11)] lg:[--solitaire-example-card:--spacing(14)]";

const figureCardWidths = {
  example: "[--solitaire-figure-card:var(--solitaire-example-card)]",
  goal: "[--solitaire-figure-card:min(var(--solitaire-example-card),calc((100cqw-28px)/4))]",
  flowFrame:
    "[--solitaire-figure-card:min(var(--solitaire-example-card),calc((100cqw-7.25rem-36px)/6))]",
} as const satisfies Record<SolitaireFigureCardSize, string>;

/** 中に置いた図に、札の幅を CSS 変数で渡す。自分では箱を作らず、中の図の並びを変えない。 */
export function FigureCardSizeScope({
  size,
  children,
}: {
  size: SolitaireFigureCardSize;
  children: ReactNode;
}) {
  return (
    <div className={`contents ${exampleCardWidth} ${figureCardWidths[size]}`}>
      {children}
    </div>
  );
}

/** 測れない環境（テストなど）で使う札の幅。スマートフォンの例の札の幅。 */
const FALLBACK_CARD_WIDTH_PX = 44;

type FigureCardWidthProps = {
  /** 測った札の幅（px）で図を描く。 */
  children: (cardWidth: number) => ReactNode;
};

/**
 * 置き場所の `FigureCardSizeScope` が決めた札の幅を測り、その幅で図を描く。盤面の部品は札の幅を数で受けるので、
 * 幅を CSS で決めたまま、場所を取らない見えない物の幅を測って渡す。置き場所のコンテナの幅で決まる大きさも、図を描く所で測る。
 * 描く前に測るので、最初の描画から測った幅で見せる。
 */
export function FigureCardWidth({ children }: FigureCardWidthProps) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [cardWidth, setCardWidth] = useState(FALLBACK_CARD_WIDTH_PX);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (probe === null) {
      return;
    }
    function measure(element: HTMLElement) {
      const width = Math.floor(element.getBoundingClientRect().width);
      if (width > 0) {
        setCardWidth(width);
      }
    }
    measure(probe);
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => measure(probe));
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute h-0 w-(--solitaire-figure-card)"
      />
      {children(cardWidth)}
    </>
  );
}
