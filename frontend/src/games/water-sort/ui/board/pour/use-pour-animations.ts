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
} from "./pour-animation";

type UsePourAnimationsOptions = {
  operation: WaterSortOperation | null;
  bottleRefs: RefObject<Array<HTMLButtonElement | null>>;
  onActivityChange?: (active: boolean) => void;
  onClearingPourComplete?: () => void;
};

export function usePourAnimations({
  operation,
  bottleRefs,
  onActivityChange,
  onClearingPourComplete,
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
        onClearingPourComplete?.();
      }
    },
    [onClearingPourComplete, replaceAnimations],
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
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (cannotAnimate) {
      if (operation.isClearingMove) {
        onClearingPourComplete?.();
      }
      return;
    }

    const sourceRect = captureRect(sourceBottle);
    const destinationRect = captureRect(destinationBottle);
    if (!sourceRect || !destinationRect) {
      if (operation.isClearingMove) {
        onClearingPourComplete?.();
      }
      return;
    }

    const animation = createPourAnimation(
      operation,
      sourceRect,
      destinationRect,
    );
    if (!animation) {
      if (operation.isClearingMove) {
        onClearingPourComplete?.();
      }
      return;
    }

    replaceAnimations(addPourAnimation(animationsRef.current, animation));
  }, [bottleRefs, onClearingPourComplete, operation, replaceAnimations]);

  return {
    animations,
    finishAnimation,
    interruptForBottleInteraction,
  };
}

function captureRect(element: HTMLElement): BottleRect | null {
  const rect = element.getBoundingClientRect();
  const values = [rect.left, rect.top, rect.width, rect.height];
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
