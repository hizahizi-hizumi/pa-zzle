import { useLayoutEffect, useRef } from "react";

import { TutorialForeground } from "@/components/TutorialForeground";
import {
  TutorialSpotlight,
  type TutorialSpotlightRole,
} from "@/components/TutorialSpotlight";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import {
  BottleCue,
  bottleShapeClassName,
} from "@/games/water-sort/ui/board/WaterSortBoard/BottleCue";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";
import { cn } from "@/lib/utils";

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled: boolean;
  onPourAnimationActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
  /** ボトルに重ねる合図。チュートリアルだけが渡す。 */
  cues?: readonly WaterSortBottleCue[];
  /** チュートリアルで手を引いている間、画面全体の覆いから抜くボトルと抜き方。`null` なら抜かない。通常のプレイでは渡さない。 */
  spotlitBottles?: readonly WaterSortBottleSpotlight[] | null;
  /** チュートリアルで手を引いている間、注ぐ動きを画面全体の覆いの上に出す。通常のプレイでは渡さない。 */
  pourInFrontOfTutorialScrim?: boolean;
};

/** チュートリアルで覆いから抜くボトルと、その抜き方（押す所か決め手か）。 */
export type WaterSortBottleSpotlight = {
  bottleIndex: number;
  role: TutorialSpotlightRole;
};

const invalidBottleShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-4px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];

const invalidBottleShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

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
  spotlitBottles = null,
  pourInFrontOfTutorialScrim = false,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { animations, finishAnimation, interruptForBottleInteraction } =
    usePourAnimations({
      operation,
      bottleRefs,
      onActivityChange: onPourAnimationActivityChange,
      onClearAnimationComplete,
    });

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
  const layout = getBoardLayout(state.length);
  const rowCount = Math.ceil(state.length / layout.columnCount);
  // ボトルの縦横比と隙間を保ったまま、見出し・下端を除いた高さにも収める。
  // 上の段のボトルを選ぶと持ち上げるので、その分の高さは盤面の上に取っておく。
  const widthForAvailableHeight = `calc((100cqh - var(--selected-bottle-lift) - ${layout.rowGap * (rowCount - 1)}px) * ${(bottleAspectRatio * layout.columnCount) / rowCount} + ${layout.columnGap * (layout.columnCount - 1)}px)`;

  const bottles = (
    <fieldset
      className={cn(
        "grid w-full items-end justify-center border-0 p-0 pt-(--selected-bottle-lift) [--selected-bottle-lift:--spacing(3.5)]",
      )}
      style={{
        gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
        columnGap: layout.columnGap,
        rowGap: layout.rowGap,
        width: `min(${layout.width}, ${widthForAvailableHeight})`,
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
        const spotlight = spotlitBottles?.find(
          (item) => item.bottleIndex === bottleIndex,
        );

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
              <WaterBottle contents={bottle} selected={isSource} />
            </span>
            <TutorialSpotlight
              active={spotlight !== undefined}
              role={spotlight?.role}
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
      <div className="flex size-full items-center justify-center [container-type:size]">
        {bottles}
      </div>

      {/* 注ぐ演出はviewport座標を使うので、サイズを制約するコンテナの外へ置く。 */}
      <TutorialForeground active={pourInFrontOfTutorialScrim}>
        <PourAnimationLayer
          animations={animations}
          onFinish={finishAnimation}
        />
      </TutorialForeground>
    </>
  );
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
