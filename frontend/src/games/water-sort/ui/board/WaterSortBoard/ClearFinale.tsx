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
  CLEAR_FINALE_GLEAM_DELAY_MS,
  CLEAR_FINALE_GLEAM_DURATION_MS,
  CLEAR_FINALE_GLEAM_STAGGER_MS,
  CLEAR_FINALE_HOLD_MS,
  CLEAR_FINALE_PUT_AWAY_DURATION_MS,
  CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
  CLEAR_FINALE_REDUCED_MOTION_HOLD_MS,
} from "@/games/water-sort/ui/board/clear-finale-timing";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

type ClearFinaleProps = {
  /** そろった盤面。 */
  state: WaterSortState;
  /** 盤面の試験管の要素（並び順は番号順）。空の試験管はこの要素ごと片付ける。 */
  bottleRefs: RefObject<Array<HTMLElement | null>>;
  /** 画面のどこかに触れると、残りを飛ばして終える。 */
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
 * 空の試験管を片付け、栓をした色の列を窓の光が順に撫でてから終える。
 * 終えた後も、盤面が替わるまで片付いた姿を保つ。
 */
export function ClearFinale({
  state,
  bottleRefs,
  skippableByTouch,
  onDone,
}: ClearFinaleProps) {
  const [sealedTubes, setSealedTubes] = useState<SealedTubeRect[] | null>(null);
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
  }, [bottleRefs, state]);

  useEffect(() => {
    if (!sealedTubes) {
      return;
    }
    const emptyElements = state.flatMap((contents, bottleIndex) => {
      const element = bottleRefs.current[bottleIndex];
      return contents.length === 0 && element ? [element] : [];
    });
    const putAwayEndMs =
      emptyElements.length * CLEAR_FINALE_PUT_AWAY_STAGGER_MS +
      CLEAR_FINALE_PUT_AWAY_DURATION_MS;
    const gleamStartMs = Math.max(
      CLEAR_FINALE_GLEAM_DELAY_MS,
      putAwayEndMs - 200,
    );
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
              easing: "cubic-bezier(.4,0,.6,1)",
              fill: "forwards",
            },
          );
          return animation ? [animation] : [];
        });
        const gleams = gleamRefs.current.flatMap((element, index) => {
          const animation = element?.animate?.(
            [
              { transform: "translateX(-160%) skewX(-18deg)", opacity: 0 },
              { opacity: 1, offset: 0.25 },
              { opacity: 1, offset: 0.75 },
              { transform: "translateX(260%) skewX(-18deg)", opacity: 0 },
            ],
            {
              duration: CLEAR_FINALE_GLEAM_DURATION_MS,
              delay: gleamStartMs + index * CLEAR_FINALE_GLEAM_STAGGER_MS,
              easing: "cubic-bezier(.45,0,.3,1)",
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
              className="absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/70 to-transparent opacity-0"
            />
          </span>
        </span>
      ))}
      {skippableByTouch && !done && (
        <button
          type="button"
          aria-label="演出を飛ばす"
          className="fixed inset-0 z-10 cursor-default bg-transparent"
          onClick={finish}
        />
      )}
    </>
  );
}
