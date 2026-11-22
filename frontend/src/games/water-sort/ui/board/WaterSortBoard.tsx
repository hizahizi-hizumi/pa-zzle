import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import { getReagentName } from "@/games/water-sort/ui/board/test-tube/reagent";
import { TestTube } from "@/games/water-sort/ui/board/test-tube/TestTube";
import { BottleCue } from "@/games/water-sort/ui/board/WaterSortBoard/BottleCue";
import { ClearFinale } from "@/games/water-sort/ui/board/WaterSortBoard/ClearFinale";
import { TestTubeRack } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";
import { cn } from "@/lib/utils";

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled: boolean;
  onPourAnimationActivityChange?: (active: boolean) => void;
  /** 盤面をそろえた手の注ぐ動きと、その後の片付ける演出を終えたときに呼ぶ。 */
  onClearAnimationComplete?: () => void;
  /** チュートリアルだけが渡す。 */
  cues?: readonly WaterSortBottleCue[];
  /**
   * ボトルの並べ方。
   * - `rows`: 本数に応じて段に分け、画面の幅に応じた幅にする。
   * - `single-row`: 全部を1段に並べ、置いた場所の幅いっぱいにする。注ぐ動きと、選んだボトルの持ち上げが盤面の外へはみ出さない余白を、置く側が上に取るときに使う。
   */
  layout?: "rows" | "single-row";
  /**
   * 1段に並べるときのボトルの間。
   * - `play`: チュートリアルの盤面。`WATER_SORT_SINGLE_ROW_GAP_PX` の間にする。
   * - `howToPlay`: 遊び方の図。置き場所が CSS 変数 `WATER_SORT_HOW_TO_PLAY_GAP_PROPERTY` で渡す、遊び方の図と同じ間にする。
   */
  spacing?: "play" | "howToPlay";
  /**
   * 試験管を立てる所。
   * - `rack-on-bench`: 実験台に置いた試験管立てに立てる。試験管立てと実験台は盤面の後ろに、置いた入れ物いっぱいに描く。
   * - `none`: 試験管だけを並べる。遊び方の図が、まわりの説明の中に盤面だけを置くときに使う。
   */
  stand?: "rack-on-bench" | "none";
  /** そろえた後の演出を、画面のどこかに触れて飛ばせるか。遊び方のゴールの盤面は、自分の飛ばすボタンを持つので外す。 */
  clearFinaleSkippableByTouch?: boolean;
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

/** ボトルの幅と高さの比。遊び方の図も、この比で本番と同じ形に描く。 */
export const WATER_SORT_BOTTLE_ASPECT_RATIO = 0.36;

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
  cues = [],
  layout: layoutKind = "rows",
  spacing = "play",
  stand = "rack-on-bench",
  clearFinaleSkippableByTouch = true,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // 演出を終えるときに呼ぶ関数は描き直しで替わってよいので、注ぐ動きと演出には替わらない関数だけを渡す。
  const latestRef = useRef({ state, onClearAnimationComplete });
  useLayoutEffect(() => {
    latestRef.current = { state, onClearAnimationComplete };
  });
  const [clearFinale, setClearFinale] = useState<ClearFinaleRun | null>(null);
  const startClearFinale = useCallback((operationId: number) => {
    setClearFinale({ operationId, settledState: null });
  }, []);
  const { animations, finishAnimation, interruptForBottleInteraction } =
    usePourAnimations({
      operation,
      bottleRefs,
      onActivityChange: onPourAnimationActivityChange,
      onClearingPourEnd: startClearFinale,
    });
  const completeClearFinale = useCallback(() => {
    const { state: settledState, onClearAnimationComplete: complete } =
      latestRef.current;
    setClearFinale((current) => current && { ...current, settledState });
    complete?.();
  }, []);
  // 演出の後、完了を受けて手の知らせが消えても、同じ盤面のうちは片付いた姿を保つ。
  // リセット・待った・別の問題で手か盤面が替わったら、前の盤面の演出は残さない。
  const showsClearFinale =
    clearFinale !== null &&
    (clearFinale.operationId === operation?.id ||
      (operation === null && clearFinale.settledState === state));

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
  const columnGap =
    layoutKind === "single-row" && spacing === "howToPlay"
      ? `var(${WATER_SORT_HOW_TO_PLAY_GAP_PROPERTY})`
      : `${layout.columnGap}px`;
  const rowCount = Math.ceil(state.length / layout.columnCount);
  // ボトルの縦横比と隙間を保ったまま、見出し・下端を除いた高さにも収める。
  // 上の段のボトルを選ぶと持ち上げるので、その分の高さは盤面の上に取っておく。
  const widthForAvailableHeight = `calc((100cqh - var(--selected-bottle-lift) - ${layout.rowGap * (rowCount - 1)}px) * ${(WATER_SORT_BOTTLE_ASPECT_RATIO * layout.columnCount) / rowCount} + ${layout.columnGap * (layout.columnCount - 1)}px)`;

  const bottles = (
    <fieldset
      className={cn(
        "grid w-full items-end justify-center border-0 p-0 [--selected-bottle-lift:--spacing(3.5)]",
        layoutKind === "rows" && "pt-(--selected-bottle-lift)",
      )}
      style={{
        gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
        columnGap,
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
            : bottle.map((colorIndex) => getReagentName(colorIndex)).join("、");
        const isSource = bottleIndex === sourceBottleIndex;
        const isAnimated = animatedBottleIndexes.has(bottleIndex);
        const cue = cues.find((item) => item.bottleIndex === bottleIndex);

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
            className="relative w-full origin-top cursor-pointer touch-manipulation disabled:cursor-default rounded-b-[1.45rem] transition-transform duration-(--duration-normal) ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 aria-pressed:-translate-y-(--selected-bottle-lift) motion-reduce:transition-none"
            style={{ aspectRatio: WATER_SORT_BOTTLE_ASPECT_RATIO }}
            disabled={interactionDisabled}
          >
            <span
              className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
            >
              <TestTube
                contents={bottle}
                heldBy={isSource ? "right" : undefined}
                stoppered={isCompleteWaterSortBottle(bottle)}
              />
            </span>
            {cue && <BottleCue cue={cue} />}
          </button>
        );
      })}
    </fieldset>
  );

  const rack = stand === "rack-on-bench" && (
    <TestTubeRack state={state} bottleRefs={bottleRefs} />
  );

  return (
    <>
      {/* 1段に並べるときは、大きさを置く側が決めるので、高さに収める入れ物に入れない。 */}
      {layoutKind === "single-row" ? (
        rack ? (
          <div className="relative w-full">
            {rack}
            {bottles}
          </div>
        ) : (
          bottles
        )
      ) : (
        <div className="relative flex size-full items-center justify-center [container-type:size]">
          {rack}
          {bottles}
        </div>
      )}

      {/* 注ぐ演出と片付ける演出はviewport座標を使うので、サイズを制約するコンテナの外へ置く。 */}
      <PourAnimationLayer animations={animations} onFinish={finishAnimation} />
      {showsClearFinale && (
        <ClearFinale
          state={state}
          bottleRefs={bottleRefs}
          skippableByTouch={clearFinaleSkippableByTouch}
          onDone={completeClearFinale}
        />
      )}
    </>
  );
}

type ClearFinaleRun = {
  operationId: number;
  /** 演出を終えたときの盤面。終える前は `null`。 */
  settledState: WaterSortState | null;
};

/** 遊び方の図が、1段に並べるボトルの間を渡す CSS 変数。 */
export const WATER_SORT_HOW_TO_PLAY_GAP_PROPERTY =
  "--water-sort-how-to-play-gap";

/** 1段に並べるときの、既定のボトルの間。`WaterSortTutorial` の盤面の余白は、この間を前提に取る。 */
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
