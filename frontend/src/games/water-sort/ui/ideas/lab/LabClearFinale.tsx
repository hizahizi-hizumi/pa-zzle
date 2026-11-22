import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  LAB_FINALE_CHIME_DELAY_MS,
  LAB_FINALE_GLEAM_DURATION_MS,
  LAB_FINALE_GLEAM_STAGGER_MS,
  LAB_FINALE_HOLD_MS,
  LAB_FINALE_PUT_AWAY_DURATION_MS,
  LAB_FINALE_PUT_AWAY_STAGGER_MS,
  LAB_FINALE_REDUCED_MOTION_HOLD_MS,
} from "@/games/water-sort/ui/ideas/lab/lab-finale-timing";
import { tubeLiftSound } from "@/games/water-sort/ui/ideas/lab/lab-sounds";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/ideas/lab/lab-tube-geometry";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { playSound } from "@/lib/audio/sound-effects";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

/** 演出が終わるのと触れて飛ばすのが重なっても、結果へは一度だけ移る。 */
function finishOnce(
  doneRef: RefObject<boolean>,
  onDoneRef: RefObject<() => void>,
) {
  if (doneRef.current) {
    return;
  }
  doneRef.current = true;
  onDoneRef.current();
}

type FinaleTube = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 空の試験管を片付け、栓をした色の列を窓の光が順に撫でてから結果へ移る。触れると飛ばす。 */
export function LabClearFinale({
  state,
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const [sealedTubes, setSealedTubes] = useState<FinaleTube[] | null>(null);
  const gleamRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  function finish() {
    finishOnce(doneRef, onDoneRef);
  }

  useLayoutEffect(() => {
    setSealedTubes(
      getBottleElements().flatMap((element, bottleIndex) => {
        if ((state[bottleIndex]?.length ?? 0) === 0) {
          return [];
        }
        const rect = element.getBoundingClientRect();
        return [
          {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        ];
      }),
    );
  }, [getBottleElements, state]);

  useEffect(() => {
    if (!sealedTubes) {
      return;
    }
    const emptyElements = getBottleElements().filter(
      (_, bottleIndex) => (state[bottleIndex]?.length ?? 0) === 0,
    );
    const putAwayEndMs =
      emptyElements.length * LAB_FINALE_PUT_AWAY_STAGGER_MS +
      LAB_FINALE_PUT_AWAY_DURATION_MS;
    const gleamStartMs = Math.max(
      LAB_FINALE_CHIME_DELAY_MS,
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
    if (!prefersReducedMotion()) {
      emptyElements.forEach((_, index) => {
        playSound(tubeLiftSound, {
          delayMs: index * LAB_FINALE_PUT_AWAY_STAGGER_MS,
          volume: 0.55,
          playbackRate: 1 + index * 0.04,
        });
      });
    }
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
              duration: LAB_FINALE_PUT_AWAY_DURATION_MS,
              delay: index * LAB_FINALE_PUT_AWAY_STAGGER_MS,
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
              duration: LAB_FINALE_GLEAM_DURATION_MS,
              delay: gleamStartMs + index * LAB_FINALE_GLEAM_STAGGER_MS,
              easing: "cubic-bezier(.45,0,.3,1)",
              fill: "both",
            },
          );
          return animation ? [animation] : [];
        });
        return [...putAway, ...gleams];
      },
      completion: { type: "after-animations", holdMs: LAB_FINALE_HOLD_MS },
      reducedMotionHoldMs: LAB_FINALE_REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: LAB_FINALE_REDUCED_MOTION_HOLD_MS,
      onFinished() {
        finishOnce(doneRef, onDoneRef);
      },
    });
    return () => {
      cancel();
      for (const animation of hiddenEmpties) {
        animation.cancel();
      }
    };
  }, [sealedTubes, getBottleElements, state]);

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
      <button
        type="button"
        aria-label="演出を飛ばす"
        className="fixed inset-0 z-10 cursor-default bg-transparent"
        onClick={finish}
      />
    </>
  );
}
