import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { getCompletedBottleColor } from "@/games/water-sort/ui/board/bottle-completion";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import {
  BottleCue,
  bottleShapeClassName,
} from "@/games/water-sort/ui/board/WaterSortBoard/BottleCue";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import {
  playAnimations,
  playRejectionShake,
  type RejectionShakeTiming,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled: boolean;
  onPourAnimationActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
  /** チュートリアルだけが渡す。 */
  cues?: readonly WaterSortBottleCue[];
  /** 画面全体の覆いから抜くボトル。`null` なら抜かない。通常のプレイでは渡さない。 */
  spotlitBottleIndices?: readonly number[] | null;
  /** `single-row` は、注ぐ動きと、選んだボトルの持ち上げが盤面の外へはみ出さない余白を、置く側が上に取るときに使う。 */
  layout?: "rows" | "single-row";
};

const invalidBottleShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0) rotate(0deg)" },
  { transform: "translateX(-10px) rotate(-4deg)" },
  { transform: "translateX(9px) rotate(3deg)" },
  { transform: "translateX(-6px) rotate(-2deg)" },
  { transform: "translateX(3px) rotate(1deg)" },
  { transform: "translateX(0) rotate(0deg)" },
];

const INVALID_BOTTLE_SHAKE_DURATION_MS = 300;
const INVALID_BOTTLE_SHAKE_EASING = "ease-out";
const invalidBottleShakeTiming: RejectionShakeTiming = {
  durationMs: INVALID_BOTTLE_SHAKE_DURATION_MS,
  easing: INVALID_BOTTLE_SHAKE_EASING,
};

/** 全ボトルがそろったとき、左上から順に弾ませる。 */
const CLEAR_BOUNCE_DURATION_MS = 300;
/** 最初のボトルと最後のボトルが弾み始める時刻の差。 */
const CLEAR_BOUNCE_SPREAD_MS = 240;
const CLEAR_BOUNCE_EASING = "ease-out";
const clearBounceKeyframes: Keyframe[] = [
  { transform: "translateY(0) scale(1, 1)" },
  { transform: "translateY(0) scale(1.08, 0.9)", offset: 0.18 },
  { transform: "translateY(-22%) scale(0.96, 1.05)", offset: 0.5 },
  { transform: "translateY(0) scale(1.05, 0.94)", offset: 0.82 },
  { transform: "translateY(0) scale(1, 1)" },
];

const bottleAspectRatio = 0.36;

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
  cues = [],
  spotlitBottleIndices = null,
  layout: layoutKind = "rows",
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const bottlesRef = useRef<HTMLFieldSetElement>(null);
  const [pouredClearOperationId, setPouredClearOperationId] = useState<
    number | null
  >(null);
  const clearingOperationId =
    operation?.type === "poured" && operation.isClearingMove
      ? operation.id
      : null;
  const handlePouredClear = useCallback(() => {
    setPouredClearOperationId(clearingOperationId);
  }, [clearingOperationId]);
  const { animations, finishAnimation, interruptForBottleInteraction } =
    usePourAnimations({
      operation,
      bottleRefs,
      bottlesRef,
      onActivityChange: onPourAnimationActivityChange,
      onClearAnimationComplete: handlePouredClear,
    });
  const celebrating =
    clearingOperationId !== null &&
    pouredClearOperationId === clearingOperationId;

  // 最後の注ぎを終えたら、全ボトルを順に弾ませてから結果へ進める。
  useEffect(() => {
    if (!celebrating || !onClearAnimationComplete) {
      return;
    }
    return playAnimations({
      animate: () => {
        const bottles = bottleRefs.current.filter(
          (bottle): bottle is HTMLButtonElement =>
            typeof bottle?.animate === "function",
        );
        return bottles.flatMap((bottle, index) => {
          const bounce: Animation | undefined = bottle.animate(
            clearBounceKeyframes,
            {
              duration: CLEAR_BOUNCE_DURATION_MS,
              delay:
                bottles.length > 1
                  ? (index / (bottles.length - 1)) * CLEAR_BOUNCE_SPREAD_MS
                  : 0,
              easing: CLEAR_BOUNCE_EASING,
            },
          );
          // Web Animations を真似るだけで動かない環境では、待つものが無い。
          return bounce ? [bounce] : [];
        });
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onClearAnimationComplete,
    });
  }, [celebrating, onClearAnimationComplete]);

  useLayoutEffect(() => {
    if (operation?.type === "invalid") {
      playRejectionShake(
        bottleRefs.current[operation.bottleIndex],
        invalidBottleShakeKeyframes,
        invalidBottleShakeTiming,
      );
    }
  }, [operation]);

  function selectBottle(bottleIndex: number) {
    if (interactionDisabled) {
      return;
    }
    if (sourceBottleIndex === null) {
      interruptForBottleInteraction(bottleIndex);
    }
    onSelectBottle(bottleIndex);
  }

  const animatedBottleIndexes = new Set(
    animations.flatMap((animation) => [
      animation.source.bottleIndex,
      animation.destination.bottleIndex,
    ]),
  );
  const layout =
    layoutKind === "single-row"
      ? getSingleRowLayout(state.length)
      : getBoardLayout(state.length);
  const rowCount = Math.ceil(state.length / layout.columnCount);
  // ボトルの縦横比と隙間を保ったまま、見出し・下端を除いた高さにも収める。
  // 上の段のボトルを選ぶと持ち上げるので、その分の高さは盤面の上に取っておく。
  const widthForAvailableHeight = `calc((100cqh - var(--selected-bottle-lift) - ${layout.rowGap * (rowCount - 1)}px) * ${(bottleAspectRatio * layout.columnCount) / rowCount} + ${layout.columnGap * (layout.columnCount - 1)}px)`;

  const bottles = (
    <fieldset
      ref={bottlesRef}
      className={cn(
        "grid w-full items-end justify-center border-0 p-0 [--selected-bottle-lift:--spacing(3.5)]",
        layoutKind === "rows" && "pt-(--selected-bottle-lift)",
      )}
      style={{
        gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
        columnGap: layout.columnGap,
        rowGap: layout.rowGap,
        width:
          layoutKind === "single-row"
            ? layout.width
            : `min(${layout.width}, ${widthForAvailableHeight})`,
      }}
    >
      {state.map((bottle, bottleIndex) => {
        const bottleLabel = `ボトル ${bottleIndex + 1}`;
        const contents =
          bottle.length === 0
            ? "空"
            : bottle
                .map((colorIndex) => getWaterColorView(colorIndex).name)
                .join("、");
        const isSource = bottleIndex === sourceBottleIndex;
        const isAnimated = animatedBottleIndexes.has(bottleIndex);
        const cue = cues.find((item) => item.bottleIndex === bottleIndex);
        const completedColor = getCompletedBottleColor(bottle);

        return (
          <button
            key={bottleLabel}
            ref={(element) => {
              bottleRefs.current[bottleIndex] = element;
            }}
            type="button"
            aria-label={`${bottleLabel}: ${contents}`}
            aria-pressed={isSource}
            onClick={() => selectBottle(bottleIndex)}
            className="relative w-full origin-top cursor-pointer touch-manipulation rounded-b-[1.45rem] transition-transform duration-(--duration-normal) ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 aria-pressed:-translate-y-(--selected-bottle-lift) motion-reduce:transition-none"
            style={{ aspectRatio: bottleAspectRatio }}
            disabled={interactionDisabled}
          >
            <span
              className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
            >
              <WaterBottle
                contents={bottle}
                selected={isSource}
                seal={
                  completedColor === null
                    ? undefined
                    : { colorIndex: completedColor }
                }
              />
            </span>
            <TutorialSpotlight
              active={spotlitBottleIndices?.includes(bottleIndex) ?? false}
              className={bottleShapeClassName}
            />
            {cue && <BottleCue cue={cue} />}
          </button>
        );
      })}
    </fieldset>
  );

  return (
    <>
      {/* 1段に並べるときは、大きさを置く側が決めるので、高さに収める入れ物に入れない。 */}
      {layoutKind === "single-row" ? (
        bottles
      ) : (
        <div className="flex size-full items-center justify-center [container-type:size]">
          {bottles}
        </div>
      )}

      {/* 注ぐ演出はviewport座標を使うので、サイズを制約するコンテナの外へ置く。 */}
      <PourAnimationLayer animations={animations} onFinish={finishAnimation} />
    </>
  );
}

/** 1段に並べるときのボトルの間。`WaterSortTutorial` の盤面の余白は、この間を前提に取る。 */
export const WATER_SORT_SINGLE_ROW_GAP_PX = 8;

function getSingleRowLayout(bottleCount: number) {
  return {
    columnCount: bottleCount,
    width: "100%",
    columnGap: WATER_SORT_SINGLE_ROW_GAP_PX,
    rowGap: 0,
  };
}

function getBoardLayout(bottleCount: number) {
  const columnCount = Math.max(3, Math.ceil(bottleCount / 2));

  if (columnCount >= 6) {
    return {
      columnCount,
      width: "min(100%, clamp(366px, 48vw, 570px))",
      columnGap: 10,
      rowGap: 34,
    };
  }
  if (columnCount === 5) {
    return {
      columnCount,
      width: "min(100%, clamp(360px, 44vw, 520px))",
      columnGap: 14,
      rowGap: 40,
    };
  }
  if (columnCount === 4) {
    return {
      columnCount,
      width: "min(100%, clamp(320px, 40vw, 450px))",
      columnGap: 16,
      rowGap: 42,
    };
  }
  return {
    columnCount,
    width: "min(100%, clamp(250px, 32vw, 340px))",
    columnGap: 18,
    rowGap: 44,
  };
}
