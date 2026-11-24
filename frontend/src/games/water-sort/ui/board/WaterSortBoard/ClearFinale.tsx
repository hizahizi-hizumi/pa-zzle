import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import {
  CLEAR_FINALE_GLEAM_DURATION_MS,
  CLEAR_FINALE_GLEAM_EASING,
  CLEAR_FINALE_HOLD_MS,
  CLEAR_FINALE_PUT_AWAY_DURATION_MS,
  CLEAR_FINALE_PUT_AWAY_EASING,
  CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
  CLEAR_FINALE_REDUCED_MOTION_HOLD_MS,
  getClearFinaleGleamStaggerMs,
  getClearFinaleGleamStartMs,
} from "@/games/water-sort/ui/board/clear-finale-timing";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

type ClearFinaleProps = {
  /** そろった盤面。 */
  state: WaterSortState;
  /** 盤面の試験管の要素（並び順は番号順）。空の試験管はこの要素ごと片付ける。 */
  bottleRefs: RefObject<Array<HTMLElement | null>>;
  /** 盤面を置いた場所。触れて飛ばせる所は、この上端から下にして、上の見出しとメニューには届くようにする。 */
  boardAreaRef: RefObject<HTMLElement | null>;
  /** 盤面から下のどこかに触れると、残りを飛ばして終える。 */
  skippableByTouch: boolean;
  onDone: () => void;
};

type SealedTubeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * 空の試験管を片付け、栓をした色の列を平らな白い帯が順に撫で、整った列を眺める間を置いてから終える。
 * 終えた後も、盤面が替わるまで片付いた姿を保つ。
 */
export function ClearFinale({
  state,
  bottleRefs,
  boardAreaRef,
  skippableByTouch,
  onDone,
}: ClearFinaleProps) {
  const [sealedTubes, setSealedTubes] = useState<SealedTubeRect[] | null>(null);
  const [skipAreaTop, setSkipAreaTop] = useState(0);
  const [done, setDone] = useState(false);
  const gleamRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  // 演出が終わるのと触れて飛ばすのが重なっても、一度だけ終える。
  const finish = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    setDone(true);
    onDoneRef.current();
  }, []);

  useLayoutEffect(() => {
    setSealedTubes(
      state.flatMap((contents, bottleIndex) => {
        const element = bottleRefs.current[bottleIndex];
        if (contents.length === 0 || !element) {
          return [];
        }
        const { left, top, width, height } = element.getBoundingClientRect();
        return [{ left, top, width, height }];
      }),
    );
    setSkipAreaTop(
      Math.max(0, boardAreaRef.current?.getBoundingClientRect().top ?? 0),
    );
  }, [bottleRefs, boardAreaRef, state]);

  useEffect(() => {
    if (!sealedTubes) {
      return;
    }
    const emptyElements = state.flatMap((contents, bottleIndex) => {
      const element = bottleRefs.current[bottleIndex];
      return contents.length === 0 && element ? [element] : [];
    });
    const gleamStartMs = getClearFinaleGleamStartMs(emptyElements.length);
    const gleamStaggerMs = getClearFinaleGleamStaggerMs(sealedTubes.length);
    // 動きを減らす設定では、空の試験管を動かさずに消して、片付いた姿だけを見せる。
    const hiddenEmpties = prefersReducedMotion()
      ? emptyElements.flatMap((element) => {
          const animation = element.animate?.([{ opacity: 0 }], {
            duration: 0,
            fill: "forwards",
          });
          return animation ? [animation] : [];
        })
      : [];
    const cancel = playAnimations({
      animate() {
        const putAway = emptyElements.flatMap((element, index) => {
          const animation = element.animate?.(
            [
              { transform: "translateY(0)", opacity: 1 },
              { transform: "translateY(-6%)", opacity: 1, offset: 0.35 },
              { transform: "translateY(-22%)", opacity: 0 },
            ],
            {
              duration: CLEAR_FINALE_PUT_AWAY_DURATION_MS,
              delay: index * CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
              easing: CLEAR_FINALE_PUT_AWAY_EASING,
              fill: "forwards",
            },
          );
          return animation ? [animation] : [];
        });
        const gleams = gleamRefs.current.flatMap((element, index) => {
          const animation = element?.animate?.(
            [
              { transform: "translateX(-150%) skewX(-18deg)", opacity: 0 },
              { opacity: 1, offset: 0.25 },
              { opacity: 1, offset: 0.75 },
              { transform: "translateX(450%) skewX(-18deg)", opacity: 0 },
            ],
            {
              duration: CLEAR_FINALE_GLEAM_DURATION_MS,
              delay: gleamStartMs + index * gleamStaggerMs,
              easing: CLEAR_FINALE_GLEAM_EASING,
              fill: "both",
            },
          );
          return animation ? [animation] : [];
        });
        return [...putAway, ...gleams];
      },
      completion: { type: "after-animations", holdMs: CLEAR_FINALE_HOLD_MS },
      reducedMotionHoldMs: CLEAR_FINALE_REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: CLEAR_FINALE_REDUCED_MOTION_HOLD_MS,
      onFinished: finish,
    });
    return () => {
      cancel();
      for (const animation of hiddenEmpties) {
        animation.cancel();
      }
    };
  }, [sealedTubes, bottleRefs, state, finish]);

  return (
    <>
      {sealedTubes?.map((tube, index) => (
        <span
          key={`${tube.left}-${tube.top}`}
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{
            left: tube.left,
            top: tube.top,
            width: tube.width,
            height: tube.height,
          }}
        >
          <span className="absolute overflow-hidden" style={LIQUID_BOX_STYLE}>
            <span
              ref={(element) => {
                gleamRefs.current[index] = element;
              }}
              className="absolute inset-y-0 left-0 w-1/4 bg-white/45 opacity-0"
            />
          </span>
        </span>
      ))}
      {skippableByTouch && !done && (
        <button
          type="button"
          aria-label="演出を飛ばす"
          data-clear-finale-skip=""
          className="fixed inset-x-0 bottom-0 z-10 cursor-default bg-transparent"
          style={{ top: skipAreaTop }}
          onClick={finish}
        />
      )}
    </>
  );
}
