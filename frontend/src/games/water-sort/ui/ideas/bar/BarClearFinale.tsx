import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { FinaleGlassLight } from "@/games/water-sort/ui/ideas/bar/BarClearFinale/FinaleGlassLight";
import {
  playGlassTing,
  playLampSwitch,
} from "@/games/water-sort/ui/ideas/bar/bar-sounds";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

type LitGlass = {
  bottleIndex: number;
  rect: DOMRect;
  colorIndex: number;
};

const FINALE_TIMING = {
  washMs: 700,
  firstGlassMs: 260,
  maxStepMs: 120,
  glassesSpanMs: 1000,
  glassFadeMs: 420,
  restAfterLastMs: 1000,
  reducedMotionRestMs: 1400,
  /** 最後の一注ぎに続けて打った指で、灯りを見る前に飛ばしてしまわないよう、見せ始めは飛ばさない。 */
  skipIgnoredMs: 300,
} as const;

function getGlassStepMs(count: number): number {
  return count <= 1
    ? 0
    : Math.min(
        FINALE_TIMING.maxStepMs,
        FINALE_TIMING.glassesSpanMs / (count - 1),
      );
}

/** 全部そろうと、店の灯りが入り、並んだグラスに左から順に灯りがともる。 */
export function BarClearFinale({
  state,
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [glasses, setGlasses] = useState<readonly LitGlass[] | null>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const lightRefs = useRef<Array<HTMLDivElement | null>>([]);
  const doneRef = useRef(false);
  const shownAtRef = useRef(0);

  function finishOnce() {
    if (!doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }

  function skip(timeStamp: number) {
    if (timeStamp - shownAtRef.current >= FINALE_TIMING.skipIgnoredMs) {
      finishOnce();
    }
  }

  const finish = useEffectEvent(finishOnce);
  const skipFromKey = useEffectEvent(skip);

  // グラスの位置は、描き終えた盤面から測る。
  useLayoutEffect(() => {
    shownAtRef.current = performance.now();
    const elements = getBottleElements();
    setGlasses(
      state.flatMap((bottle, bottleIndex): LitGlass[] => {
        const element = elements[bottleIndex];
        const colorIndex = bottle[0];
        return element && colorIndex !== undefined
          ? [{ bottleIndex, rect: element.getBoundingClientRect(), colorIndex }]
          : [];
      }),
    );
  }, [getBottleElements, state]);

  useEffect(() => {
    if (!glasses) {
      return;
    }
    const stepMs = getGlassStepMs(glasses.length);
    const lastLitMs =
      FINALE_TIMING.firstGlassMs + stepMs * Math.max(0, glasses.length - 1);
    const timers: number[] = [];
    if (reduced) {
      timers.push(window.setTimeout(() => playGlassTing(0, 1), 0));
    } else {
      playLampSwitch();
      glasses.forEach((_, order) => {
        timers.push(
          window.setTimeout(
            () => playGlassTing(order, glasses.length),
            FINALE_TIMING.firstGlassMs + stepMs * order,
          ),
        );
      });
    }
    const cancel = playAnimations({
      animate() {
        const animations: Animation[] = [];
        const wash = washRef.current?.animate?.(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: FINALE_TIMING.washMs, easing: "ease-out", fill: "both" },
        );
        if (wash) {
          animations.push(wash);
        }
        glasses.forEach((_, order) => {
          const light = lightRefs.current[order]?.animate?.(
            [
              { opacity: 0, filter: "brightness(1.6)" },
              { opacity: 1, filter: "brightness(1)" },
            ],
            {
              duration: FINALE_TIMING.glassFadeMs,
              delay: FINALE_TIMING.firstGlassMs + stepMs * order,
              easing: "ease-out",
              fill: "both",
            },
          );
          if (light) {
            animations.push(light);
          }
        });
        return animations;
      },
      completion: {
        type: "after-duration",
        durationMs: lastLitMs + FINALE_TIMING.restAfterLastMs,
      },
      reducedMotionHoldMs: FINALE_TIMING.reducedMotionRestMs,
      unanimatedHoldMs: FINALE_TIMING.reducedMotionRestMs,
      onFinished: finish,
    });
    return () => {
      cancel();
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [glasses, reduced]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // 見出しのメニューなど、フォーカスのある操作のキーは奪わない。
      if (event.target !== document.body) return;
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Escape"
      ) {
        event.preventDefault();
        skipFromKey(event.timeStamp);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[5] cursor-pointer touch-manipulation"
      // 押した指の click が、飛ばした直後に出る結果画面のボタンへ届かないよう、click で飛ばす。
      onClick={(event) => skip(event.timeStamp)}
    >
      <div
        ref={washRef}
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_45%_at_50%_8%,rgba(255,178,98,0.42),transparent_70%),radial-gradient(ellipse_120%_40%_at_50%_100%,rgba(255,160,80,0.12),transparent_70%)] mix-blend-screen"
        style={{ opacity: reduced ? 1 : 0 }}
      />
      {glasses?.map((glass, order) => (
        <FinaleGlassLight
          key={glass.bottleIndex}
          rect={glass.rect}
          colorIndex={glass.colorIndex}
          lit={reduced}
          lightRef={(element) => {
            lightRefs.current[order] = element;
          }}
        />
      ))}
    </div>
  );
}
