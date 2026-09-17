import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-game";
import {
  addPourPresentation,
  type BottleRect,
  createPourPresentation,
  interruptPourPresentationsForBottle,
  type PourPresentation,
} from "./pour-presentation";

type UsePourPresentationsOptions = {
  operation: WaterSortOperation | null;
  bottleRefs: RefObject<Array<HTMLButtonElement | null>>;
  onActivityChange?: (active: boolean) => void;
  onClearingPourComplete?: () => void;
};

export function usePourPresentations({
  operation,
  bottleRefs,
  onActivityChange,
  onClearingPourComplete,
}: UsePourPresentationsOptions) {
  const [presentations, setPresentations] = useState<
    readonly PourPresentation[]
  >([]);
  const presentationsRef = useRef<readonly PourPresentation[]>([]);
  const activeRef = useRef(false);
  const processedPourIdsRef = useRef(new Set<number>());

  const replacePresentations = useCallback(
    (next: readonly PourPresentation[]) => {
      presentationsRef.current = next;
      setPresentations(next);

      const active = next.length > 0;
      if (activeRef.current !== active) {
        activeRef.current = active;
        onActivityChange?.(active);
      }
    },
    [onActivityChange],
  );

  const finishPresentation = useCallback(
    (presentationId: number) => {
      const current = presentationsRef.current;
      const presentation = current.find(({ id }) => id === presentationId);
      if (!presentation) {
        return;
      }

      replacePresentations(current.filter(({ id }) => id !== presentationId));
      if (presentation.isClearingMove) {
        onClearingPourComplete?.();
      }
    },
    [onClearingPourComplete, replacePresentations],
  );

  const interruptForBottleInteraction = useCallback(
    (bottleIndex: number) => {
      replacePresentations(
        interruptPourPresentationsForBottle(
          presentationsRef.current,
          bottleIndex,
        ),
      );
    },
    [replacePresentations],
  );

  useLayoutEffect(() => {
    if (!operation) {
      processedPourIdsRef.current.clear();
      replacePresentations([]);
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

    const presentation = createPourPresentation(
      operation,
      sourceRect,
      destinationRect,
    );
    if (!presentation) {
      if (operation.isClearingMove) {
        onClearingPourComplete?.();
      }
      return;
    }

    replacePresentations(
      addPourPresentation(presentationsRef.current, presentation),
    );
  }, [bottleRefs, onClearingPourComplete, operation, replacePresentations]);

  return {
    presentations,
    finishPresentation,
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
