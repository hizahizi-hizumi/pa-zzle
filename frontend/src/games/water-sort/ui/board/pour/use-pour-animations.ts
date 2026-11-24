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
  createPourAnimation,
  interruptPourAnimationsForBottle,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import type {
  BottleRect,
  PourBounds,
} from "@/games/water-sort/ui/board/pour/pour-path";
import { measureHeldClampSide } from "@/games/water-sort/ui/board/test-tube/clamp-side";
import { prefersReducedMotion } from "@/lib/motion";

type UsePourAnimationsOptions = {
  operation: WaterSortOperation | null;
  bottleRefs: RefObject<Array<HTMLButtonElement | null>>;
  /** 盤面を置いた場所。注ぎ元を持っていた試験管ばさみの柄の向きを、盤面と同じに求める。 */
  boardAreaRef: RefObject<HTMLElement | null>;
  onActivityChange?: (active: boolean) => void;
  /** 盤面をそろえた手の注ぐ動きを終えたとき（動かせないときは、その手を受け取ったとき）に、その手の番号で呼ぶ。 */
  onClearingPourEnd: (operationId: number) => void;
};

export function usePourAnimations({
  operation,
  bottleRefs,
  boardAreaRef,
  onActivityChange,
  onClearingPourEnd,
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
        onClearingPourEnd(animation.id);
      }
    },
    [onClearingPourEnd, replaceAnimations],
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
        onClearingPourEnd(operation.id);
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
        onClearingPourEnd(operation.id);
      }
      return;
    }

    const animation = createPourAnimation(
      operation,
      {
        sourceRect,
        sourceLiftY,
        sourceHeldClampSide: measureHeldClampSide(
          sourceBottle,
          boardAreaRef.current,
        ),
        destinationRect,
        bounds: capturePourBounds(sourceBottle),
      },
      animationsRef.current,
    );
    if (!animation) {
      if (operation.isClearingMove) {
        onClearingPourEnd(operation.id);
      }
      return;
    }

    replaceAnimations(addPourAnimation(animationsRef.current, animation));
  }, [
    bottleRefs,
    boardAreaRef,
    onClearingPourEnd,
    operation,
    replaceAnimations,
  ]);

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
  const translateY = translate.split(" ")[1];
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

/** 画面の端から、傾けた試験管の柄までに残す間（px）。 */
const POUR_EDGE_MARGIN_PX = 4;

/**
 * 盤面を置く `main` の前の見出し（プレイ画面とチュートリアル）の、文字とボタンの下端。
 * 見出しの箱の下の、何も描かない余白には注ぐ動きがかかってよい。見出しが無ければ `main` の上端。
 */
function getHeadingContentBottom(main: HTMLElement): number {
  const heading = main.parentElement?.querySelector(":scope > header");
  const bottoms = heading
    ? [...heading.children].map((child) => child.getBoundingClientRect().bottom)
    : [];
  return bottoms.length > 0
    ? Math.max(...bottoms)
    : main.getBoundingClientRect().top;
}

/**
 * 注ぐ動きを収める範囲。上は見出しの文字とボタンの下端、左右は画面の端。
 * `main` の外に置く盤面（遊び方の図）は、上も画面の端まで使う。
 */
function capturePourBounds(element: HTMLElement): PourBounds {
  const main = element.closest("main");
  const viewportWidth = document.documentElement.clientWidth;
  return {
    top: (main ? getHeadingContentBottom(main) : 0) + POUR_EDGE_MARGIN_PX,
    left: POUR_EDGE_MARGIN_PX,
    right: viewportWidth - POUR_EDGE_MARGIN_PX,
  };
}
