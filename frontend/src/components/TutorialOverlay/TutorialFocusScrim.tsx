import {
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { TUTORIAL_SPOTLIGHT_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { cn } from "@/lib/utils";

type TutorialFocusScrimProps = {
  /** `true` の間、覆いを出す。手を引いている間だけ渡し、導入・手を離した後・完成では出さない。 */
  active: boolean;
  /** 抜く所を探す範囲。チュートリアルの画面そのもの。 */
  containerRef: RefObject<HTMLElement | null>;
};

/** 覆いの座標で表した、抜く所の角丸の四角。角丸は左上・右上・右下・左下の順に、角ごとに持つ。 */
type Hole = {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: readonly [number, number, number, number];
};

const cornerRadiusProperties = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
] as const;

/**
 * 暗い配色では `foreground` が明るい色になるので、`background` を濃く重ねる。
 */
const scrimFillClassName = "fill-foreground/55 dark:fill-background/75";

function round(value: number): number {
  return Math.round(value * 2) / 2;
}

function getHoleKey({ x, y, width, height, radii }: Hole): string {
  return [x, y, width, height, ...radii].join(",");
}

/** 底だけが丸いボトルのように、角ごとに違う角丸の物も、その形のまま抜く。 */
function getHolePath({ x, y, width, height, radii }: Hole): string {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii;
  const right = x + width;
  const bottom = y + height;
  return [
    `M${x + topLeft},${y}`,
    `H${right - topRight}`,
    `A${topRight},${topRight} 0 0 1 ${right},${y + topRight}`,
    `V${bottom - bottomRight}`,
    `A${bottomRight},${bottomRight} 0 0 1 ${right - bottomRight},${bottom}`,
    `H${x + bottomLeft}`,
    `A${bottomLeft},${bottomLeft} 0 0 1 ${x},${bottom - bottomLeft}`,
    `V${y + topLeft}`,
    `A${topLeft},${topLeft} 0 0 1 ${x + topLeft},${y}`,
    "Z",
  ].join(" ");
}

function measureHoles(svg: SVGSVGElement, container: HTMLElement): Hole[] {
  const origin = svg.getBoundingClientRect();
  const holes = Array.from(
    container.querySelectorAll<HTMLElement>(
      `[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`,
    ),
  ).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return [];
    }
    // 抜く物の形のまま抜く。角の無い物は角の無いまま、角丸の物はその角ごとの角丸で抜き、覆いのための余白は足さない。
    const style = getComputedStyle(element);
    const maxRadius = Math.min(rect.width, rect.height) / 2;
    const [topLeft, topRight, bottomRight, bottomLeft] =
      cornerRadiusProperties.map((property) =>
        round(Math.min(Number.parseFloat(style[property]) || 0, maxRadius)),
      );
    return [
      {
        x: round(rect.left - origin.left),
        y: round(rect.top - origin.top),
        width: round(rect.width),
        height: round(rect.height),
        radii: [topLeft ?? 0, topRight ?? 0, bottomRight ?? 0, bottomLeft ?? 0],
      } satisfies Hole,
    ];
  });
  // スライドで空白へ入るタイルのように、抜く所が同じ形で重なったときは1つにまとめる。
  return [...new Map(holes.map((hole) => [getHoleKey(hole), hole])).values()];
}

function getHolesKey(holes: readonly Hole[]): string {
  return holes.map(getHoleKey).join(";");
}

/**
 * チュートリアルで手を引いている間の覆い。各ゲームは抜く所に `TutorialSpotlight` を置くか `TUTORIAL_SPOTLIGHT_ATTRIBUTE` を付けるだけにし、覆いを描かない。
 *
 * 覆いは画面の一番上に置いた1枚の SVG に描き、抜く所は `<mask>` の四角で空ける。四角の角丸は抜く物の角丸に合わせる。
 * - 盤面の物は transform・will-change・アニメーションで重なりの文脈が分かれているので、物を z-index で覆いの上へ持ち上げる作りは文脈を越えられない。
 * - 抜く所ごとに外側へ大きく広がる box-shadow で覆いを作ると、離れた2つ目の抜く所を1つ目の影が塗りつぶし、合成レイヤーに載った物では影が巨大なレイヤーになる。
 * - SVG の mask は重なりの文脈にも合成レイヤーにも左右されず、抜く所がいくつあっても、重なっても1枚の覆いのまま崩れない。
 * 覆いは押した手を通すので、盤面の操作は覆いが無いときと同じに届く。
 */
export function TutorialFocusScrim({
  active,
  containerRef,
}: TutorialFocusScrimProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [holes, setHoles] = useState<readonly Hole[]>([]);
  const holesKeyRef = useRef("");
  const maskId = `tutorial-focus-scrim-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const updateHoles = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) {
      return;
    }
    const next = measureHoles(svg, container);
    const key = getHolesKey(next);
    if (key !== holesKeyRef.current) {
      holesKeyRef.current = key;
      setHoles(next);
    }
  }, [containerRef]);

  // 描く前に読み、抜く所が替わった瞬間に一言や印が覆いに隠れないようにする。覆いを消す間は、最後に抜いた所のまま消す。
  useLayoutEffect(() => {
    if (active) {
      updateHoles();
    }
  });

  // 動いている物（スライド・揺れ）にも追いつくよう、毎フレーム読む。
  useLayoutEffect(() => {
    if (!active || typeof window.requestAnimationFrame !== "function") {
      return;
    }
    let frame = window.requestAnimationFrame(function follow() {
      updateHoles();
      frame = window.requestAnimationFrame(follow);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, updateHoles]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      data-tutorial-focus-scrim={active || undefined}
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-30 h-[calc(100%+env(safe-area-inset-bottom))] w-full transition-opacity duration-(--duration-normal) ease-standard motion-reduce:transition-none",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <rect width="100%" height="100%" fill="white" />
          {holes.map((hole) => (
            <path key={getHoleKey(hole)} d={getHolePath(hole)} fill="black" />
          ))}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        mask={`url(#${maskId})`}
        className={scrimFillClassName}
      />
    </svg>
  );
}
