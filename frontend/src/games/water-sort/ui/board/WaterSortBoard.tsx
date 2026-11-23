import {
  type CSSProperties,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { PourAnimationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer";
import { usePourAnimations } from "@/games/water-sort/ui/board/pour/use-pour-animations";
import { WATER_SORT_REJECTION_DURATION_MS } from "@/games/water-sort/ui/board/rejection-timing";
import { getReagentName } from "@/games/water-sort/ui/board/test-tube/reagent";
import { TestTube } from "@/games/water-sort/ui/board/test-tube/TestTube";
import { BottleCue } from "@/games/water-sort/ui/board/WaterSortBoard/BottleCue";
import { ClearFinale } from "@/games/water-sort/ui/board/WaterSortBoard/ClearFinale";
import { TestTubeRack } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack";
import {
  playRejectionShake,
  prefersReducedMotion,
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
   * - `rack`: 試験管立てに立てる。試験管立ては盤面の後ろに描く。
   * - `none`: 試験管だけを並べる。遊び方の図が、まわりの説明の中に盤面だけを置くときに使う。
   */
  stand?: "rack" | "none";
  /** そろえた後の演出を、画面のどこかに触れて飛ばせるか。遊び方のゴールの盤面は、自分の飛ばすボタンを持つので外す。 */
  clearFinaleSkippableByTouch?: boolean;
};

/** 注げない試験管が、試験管立ての穴の中で底を支点にかたかたと揺れる。音の当たる所で少し跳ねる。 */
const rattleKeyframes: Keyframe[] = [
  { transform: "rotate(0deg) translateY(0)", transformOrigin: "50% 100%" },
  {
    transform: "rotate(-3.4deg) translateY(-1.5px)",
    transformOrigin: "50% 100%",
    offset: 0.14,
  },
  {
    transform: "rotate(2.8deg) translateY(0)",
    transformOrigin: "50% 100%",
    offset: 0.34,
  },
  {
    transform: "rotate(-2deg) translateY(-1px)",
    transformOrigin: "50% 100%",
    offset: 0.54,
  },
  {
    transform: "rotate(1.1deg) translateY(0)",
    transformOrigin: "50% 100%",
    offset: 0.74,
  },
  { transform: "rotate(0deg) translateY(0)", transformOrigin: "50% 100%" },
];

const rattleTiming: RejectionShakeTiming = {
  durationMs: WATER_SORT_REJECTION_DURATION_MS,
  easing: "linear",
};

/** 持っている試験管を注ぎ先へ傾けかけて、注げずに引き戻す。`direction` は注ぎ先のある向き（右が 1）。 */
function getWithdrawKeyframes(direction: 1 | -1): Keyframe[] {
  const origin = "50% 8%";
  return [
    { transform: "translateX(0) rotate(0deg)", transformOrigin: origin },
    {
      transform: `translateX(${direction * 4}px) rotate(${direction * 9}deg)`,
      transformOrigin: origin,
      offset: 0.3,
      easing: "cubic-bezier(.2,0,.4,1)",
    },
    {
      transform: `translateX(${direction * -1.5}px) rotate(${direction * -3}deg)`,
      transformOrigin: origin,
      offset: 0.62,
      easing: "ease-in-out",
    },
    { transform: "translateX(0) rotate(0deg)", transformOrigin: origin },
  ];
}

const withdrawTiming: RejectionShakeTiming = {
  durationMs: WATER_SORT_REJECTION_DURATION_MS,
  easing: "linear",
};

/** 動きを減らす設定では、注げなかった試験管を動かさずに一度だけ暗くする。 */
const reducedMotionRejectionKeyframes: Keyframe[] = [
  { filter: "brightness(1)" },
  { filter: "brightness(0.55)", offset: 0.25 },
  { filter: "brightness(1)" },
];

/**
 * 上の段へ注ぐ試験管が、上の段の口より上へ出る高さ（試験管の幅に対する比）。
 * 注ぎ先の口の上で深く傾き、満ちた試験管を隣の空の試験管へ注ぎきるときに、底と試験管ばさみの柄がいちばん高く出る。
 */
const TOP_ROW_POUR_REACH_RATIO = 0.75;

/**
 * 段に分けた盤面の上の端より上で、注ぐ動きがかかってよい高さ。プレイ画面の見出しの箱の下の、文字とボタンの無い余白（24px）と、
 * 盤面を置く場所の上の余白（8px）から、注ぐ動きと見出しの文字の間に残す 4px を除く。
 */
const ROOM_ABOVE_ROWS_PX = 28;

/** 持った試験管を、試験管ばさみの所を中心に少し傾ける。 */
const heldTiltClassName =
  "origin-[50%_8%] transition-[rotate] duration-(--duration-normal) ease-standard data-held:-rotate-3 motion-reduce:transition-none";

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
  stand = "rack",
  clearFinaleSkippableByTouch = true,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tubeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const boardAreaRef = useRef<HTMLElement | null>(null);
  function setBoardArea(element: HTMLElement | null) {
    boardAreaRef.current = element;
  }
  // 演出を終えるときに呼ぶ関数は描き直しで替わってよいので、注ぐ動きと演出には替わらない関数だけを渡す。
  const latestRef = useRef({
    state,
    onClearAnimationComplete,
    sourceBottleIndex,
  });
  useLayoutEffect(() => {
    latestRef.current = { state, onClearAnimationComplete, sourceBottleIndex };
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
    if (operation?.type !== "invalid") {
      return;
    }
    playRejection(
      bottleRefs.current,
      tubeRefs.current,
      operation.bottleIndex,
      latestRef.current.sourceBottleIndex,
    );
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
  const columnGaps = layout.columnGap * (layout.columnCount - 1);
  // 段に分けるときは、試験管の縦横比と隙間を保ったまま、見出し・下端を除いた高さにも収める。
  // 上の段の試験管は、持つと持ち上がり、注ぐと口より上へ出るので、そのどちらか高いほうを盤面の上に取っておく。
  const rowGaps = layout.rowGap * (rowCount - 1);
  const rowsHeightInTubeWidths = rowCount / WATER_SORT_BOTTLE_ASPECT_RATIO;
  const rowsTubeWidth = `min(calc((100cqw - ${columnGaps}px) / ${layout.columnCount}), calc((100cqh - var(--selected-bottle-lift) - ${rowGaps}px) / ${rowsHeightInTubeWidths}), calc((100cqh + ${ROOM_ABOVE_ROWS_PX - rowGaps}px) / ${rowsHeightInTubeWidths + TOP_ROW_POUR_REACH_RATIO}))`;

  const bottles = (
    <fieldset
      ref={
        layoutKind === "single-row" && stand === "none"
          ? setBoardArea
          : undefined
      }
      className={cn(
        "grid w-full items-end justify-center border-0 p-0 [--selected-bottle-lift:--spacing(5)]",
        layoutKind === "rows" &&
          "pt-[max(var(--selected-bottle-lift),var(--tube-width)*var(--top-row-pour-reach)-var(--room-above-rows))]",
      )}
      style={
        {
          gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
          columnGap,
          rowGap: layout.rowGap,
          ...(layoutKind === "single-row"
            ? { width: "100%" }
            : {
                "--tube-width": rowsTubeWidth,
                "--top-row-pour-reach": TOP_ROW_POUR_REACH_RATIO,
                "--room-above-rows": `${ROOM_ABOVE_ROWS_PX}px`,
                width: `calc(var(--tube-width) * ${layout.columnCount} + ${columnGaps}px)`,
              }),
        } as CSSProperties
      }
    >
      {state.map((bottle, bottleIndex) => {
        const bottleLabel = `試験管 ${bottleIndex + 1}`;
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
            className="relative w-full origin-top cursor-pointer touch-manipulation disabled:cursor-default rounded-b-[50%_9%] transition-transform duration-(--duration-normal) ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 aria-pressed:-translate-y-(--selected-bottle-lift) motion-reduce:transition-none"
            style={{ aspectRatio: WATER_SORT_BOTTLE_ASPECT_RATIO }}
            disabled={interactionDisabled}
          >
            <span
              className={`absolute inset-0 ${isAnimated ? "invisible" : ""}`}
            >
              <span
                ref={(element) => {
                  tubeRefs.current[bottleIndex] = element;
                }}
                data-held={isSource ? "" : undefined}
                className={cn("absolute inset-0", heldTiltClassName)}
              >
                <TestTube
                  contents={bottle}
                  heldBy={isSource ? "right" : undefined}
                  stoppered={isCompleteWaterSortBottle(bottle)}
                />
              </span>
            </span>
            {cue && (
              // 印と合図は、持った試験管と一緒に傾けて、試験管の形からずらさない。
              <span
                data-held={isSource ? "" : undefined}
                className={cn(
                  "pointer-events-none absolute inset-0",
                  heldTiltClassName,
                )}
              >
                <BottleCue cue={cue} />
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );

  const rack = stand === "rack" && (
    <TestTubeRack bottleCount={state.length} bottleRefs={bottleRefs} />
  );

  return (
    <>
      {/* 1段に並べるときは、大きさを置く側が決めるので、高さに収める入れ物に入れない。 */}
      {layoutKind === "single-row" ? (
        rack ? (
          <div ref={setBoardArea} className="relative w-full">
            {rack}
            {bottles}
          </div>
        ) : (
          bottles
        )
      ) : (
        <div
          ref={setBoardArea}
          className="relative flex size-full items-center justify-center [container-type:size]"
        >
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
          boardAreaRef={boardAreaRef}
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
    columnGap: WATER_SORT_SINGLE_ROW_GAP_PX,
    rowGap: 0,
  };
}

/** 段に分けるときの、1段の本数と試験管の間。大きさは置いた場所の幅と高さに収まるいっぱいにする。 */
function getBoardLayout(bottleCount: number) {
  const columnCount = Math.max(3, Math.ceil(bottleCount / 2));

  if (columnCount >= 6) {
    return { columnCount, columnGap: 8, rowGap: 30 };
  }
  if (columnCount === 5) {
    return { columnCount, columnGap: 12, rowGap: 26 };
  }
  if (columnCount === 4) {
    return { columnCount, columnGap: 16, rowGap: 22 };
  }
  return { columnCount, columnGap: 18, rowGap: 22 };
}

/**
 * 注げなかった試験管を、試験管立ての中でかたかた揺らす。
 * 試験管を持っていて別の試験管へ注げなかったときは、持っている試験管も注ぎ先へ傾けかけて引き戻す。
 */
function playRejection(
  bottles: readonly (HTMLElement | null)[],
  tubes: readonly (HTMLElement | null)[],
  rejectedIndex: number,
  heldIndex: number | null,
) {
  if (prefersReducedMotion()) {
    tubes[rejectedIndex]?.animate?.(reducedMotionRejectionKeyframes, {
      duration: WATER_SORT_REJECTION_DURATION_MS,
      easing: "ease-out",
    });
    return;
  }
  const rejected = bottles[rejectedIndex];
  playRejectionShake(rejected, rattleKeyframes, rattleTiming);
  const held = heldIndex === null ? null : bottles[heldIndex];
  if (!held || !rejected || heldIndex === rejectedIndex) {
    return;
  }
  const direction =
    rejected.getBoundingClientRect().left >= held.getBoundingClientRect().left
      ? 1
      : -1;
  playRejectionShake(held, getWithdrawKeyframes(direction), withdrawTiming);
}
