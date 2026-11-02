import {
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  TUTORIAL_SPOTLIGHT_ATTRIBUTE,
  TUTORIAL_SPOTLIGHT_PADDING_ATTRIBUTE,
} from "@/components/TutorialSpotlight";
import { cn } from "@/lib/utils";

type TutorialFocusScrimProps = {
  /** `true` の間、覆いを出す。手を引いている間だけ渡す。 */
  active: boolean;
  /** 抜く所を探す範囲。チュートリアルの画面そのもの。 */
  containerRef: RefObject<HTMLElement | null>;
};

/** 覆いの座標で表した、抜く所の角丸の四角。 */
type Hole = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

/**
 * 覆いの色と濃さ。盤面の状態はまだ読めるが、抜いた所だけが明らかに明るく見える程度にする。
 * 暗い配色では `foreground` が明るい色になるので、`background` を濃く重ねる。
 */
const scrimFillClassName = "fill-foreground/55 dark:fill-background/75";

function round(value: number): number {
  return Math.round(value * 2) / 2;
}

/** 印の付いた要素の今の位置・大きさ・角丸を、覆いの座標で読む。動いている物（スライド・揺れ）にも追いつくよう、毎フレーム読む。 */
function measureHoles(svg: SVGSVGElement, container: HTMLElement): Hole[] {
  const origin = svg.getBoundingClientRect();
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`,
    ),
  ).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return [];
    }
    const padding =
      Number(element.getAttribute(TUTORIAL_SPOTLIGHT_PADDING_ATTRIBUTE)) || 0;
    const radius =
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;
    return [
      {
        x: round(rect.left - origin.left - padding),
        y: round(rect.top - origin.top - padding),
        width: round(width),
        height: round(height),
        radius: round(Math.min(radius + padding, width / 2, height / 2)),
      },
    ];
  });
}

function getHolesKey(holes: readonly Hole[]): string {
  return holes
    .map(({ x, y, width, height, radius }) =>
      [x, y, width, height, radius].join(","),
    )
    .join(";");
}

/**
 * 画面全体に暗い覆いを重ね、次に押す所・決め手・一言だけを抜いて元の明るさで見せる（コーチマーク）。
 *
 * 覆いは画面の一番上に置いた1枚の SVG に描き、抜く所は `<mask>` の角丸の四角で空ける。
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
        // 画面の下端の安全領域（ホームバーの所）まで覆う。
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
            <rect
              key={`${hole.x},${hole.y}`}
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={hole.radius}
              ry={hole.radius}
              fill="black"
            />
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
