import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  addPourAnimation,
  type BottleRect,
  createPourAnimation,
  interruptPourAnimationsForBottle,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { prefersReducedMotion } from "@/lib/motion";

type UsePourAnimationsOptions = {
  operation: WaterSortOperation | null;
  bottleRefs: RefObject<Array<HTMLButtonElement | null>>;
  onActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
};

export function usePourAnimations({
  operation,
  bottleRefs,
  onActivityChange,
  onClearAnimationComplete,
}: UsePourAnimationsOptions) {
  const [animations, setAnimations] = useState<readonly PourAnimation[]>([]);
  const animationsRef = useRef<readonly PourAnimation[]>([]);
  const activeRef = useRef(false);
  const processedPourIdsRef = useRef(new Set<number>());

  const replaceAnimations = useCallback(
    (next: readonly PourAnimation[]) => {
      animationsRef.current = next;
      setAnimations(next);

      const active = next.length > 0;
      if (activeRef.current !== active) {
        activeRef.current = active;
        onActivityChange?.(active);
      }
    },
    [onActivityChange],
  );

  const finishAnimation = useCallback(
    (animationId: number) => {
      const current = animationsRef.current;
      const animation = current.find(({ id }) => id === animationId);
      if (!animation) {
        return;
      }

      replaceAnimations(current.filter(({ id }) => id !== animationId));
      if (animation.isClearingMove) {
        onClearAnimationComplete?.();
      }
    },
    [onClearAnimationComplete, replaceAnimations],
  );

  const interruptForBottleInteraction = useCallback(
    (bottleIndex: number) => {
      replaceAnimations(
        interruptPourAnimationsForBottle(animationsRef.current, bottleIndex),
      );
    },
    [replaceAnimations],
  );

  useLayoutEffect(() => {
    if (!operation) {
      processedPourIdsRef.current.clear();
      replaceAnimations([]);
      return;
    }
    if (operation.type !== "poured") {
      return;
    }
    if (processedPourIdsRef.current.has(operation.id)) {
      return;
    }
    processedPourIdsRef.current.add(operation.id);

    const sourceBottle = bottleRefs.current[operation.sourceBottleIndex];
    const destinationBottle =
      bottleRefs.current[operation.destinationBottleIndex];
    const cannotAnimate =
      !sourceBottle ||
      !destinationBottle ||
      typeof sourceBottle.animate !== "function" ||
      prefersReducedMotion();

    if (cannotAnimate) {
      if (operation.isClearingMove) {
        onClearAnimationComplete?.();
      }
      return;
    }

    const sourceLiftY = captureLiftY(sourceBottle);
    const sourceRect = captureRestingRect(sourceBottle, sourceLiftY);
    const destinationRect = captureRestingRect(
      destinationBottle,
      captureLiftY(destinationBottle),
    );
    if (!sourceRect || !destinationRect) {
      if (operation.isClearingMove) {
        onClearAnimationComplete?.();
      }
      return;
    }

    const animation = createPourAnimation(
      operation,
      sourceRect,
      sourceLiftY,
      destinationRect,
    );
    if (!animation) {
      if (operation.isClearingMove) {
        onClearAnimationComplete?.();
      }
      return;
    }

    replaceAnimations(addPourAnimation(animationsRef.current, animation));
  }, [bottleRefs, onClearAnimationComplete, operation, replaceAnimations]);

  return {
    animations,
    finishAnimation,
    interruptForBottleInteraction,
  };
}

/**
 * ボトルを今持ち上げている量（px、上が負）。
 * 持ち上げは CSS の `translate` で行い、選択を外した直後は置かれている位置へ戻る遷移の途中にあるので、計算済みの値を読む。
 */
function captureLiftY(element: HTMLElement): number {
  const { translate } = getComputedStyle(element);
  const translateY = translate?.split(" ")[1];
  if (!translateY) {
    return 0;
  }
  const liftY = Number.parseFloat(translateY);
  return Number.isFinite(liftY) ? liftY : 0;
}

function captureRestingRect(
  element: HTMLElement,
  liftY: number,
): BottleRect | null {
  const rect = element.getBoundingClientRect();
  const restingRect = {
    left: rect.left,
    top: rect.top - liftY,
    width: rect.width,
    height: rect.height,
  };
  const values = Object.values(restingRect);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return restingRect;
}
