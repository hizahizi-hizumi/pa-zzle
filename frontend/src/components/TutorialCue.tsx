import { Check, Pointer } from "lucide-react";

import { cn } from "@/lib/utils";

/** 指の印。覆い（`TutorialFocusScrim`）が、指の所も覆いから抜くために探す。 */
export const TUTORIAL_CUE_HAND_ATTRIBUTE = "data-tutorial-cue-hand";

export type TutorialCueSwipeDirection = "up" | "down" | "left" | "right";

/**
 * - `mark`: 次に押す所の印。`recallId` は印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 * - `pointer`: 次に押す所を、輪郭の印に加えて、押すしぐさをする指で指す。`recallId` は `mark` と同じ。
 *   `placement` は指を置く所。`below`（既定）は押す物のすぐ下から下の縁を指す。`center` は押す物の中央を指し、下に別の物が詰まっているマス目で使う。
 *   `swipe` はスワイプで動かす物に渡す向き。指が押すしぐさの代わりに、その向きへ滑るしぐさを繰り返す。
 *   `outlined` を `false` にすると、輪郭の印を描かず指だけを出す。動かす物と着く所が別で、着く所に `mark` を付けるときに、印を1つにするために使う。
 * - `acknowledgement`: 本番に同じ合図が無いときの、手が成立した瞬間の応え。`id` が変わるとやり直す。
 * - `achievement`: 本番に同じ合図が無いときの、盤面の一部を仕上げたことへの応え。
 */
type TutorialCueProps =
  | { kind: "mark"; recallId: number | null }
  | {
      kind: "pointer";
      recallId: number | null;
      placement?: "below" | "center";
      swipe?: TutorialCueSwipeDirection;
      outlined?: boolean;
    }
  | { kind: "acknowledgement"; id: number }
  | { kind: "achievement" };

/** 押す物の形に沿わせるため、置き場所の要素いっぱいに、その要素と同じ角丸で描く。 */
const fillPlacementClassName =
  "pointer-events-none absolute inset-0 rounded-[inherit]";

/** 動きを減らす設定でも、位置や大きさを変えないので同じに見せる。 */
const fadeAwayClassName =
  "fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard";

/** 指が滑る向き。滑る長さは、向きが読み取れて、隣の物まで届かない長さにする。動きを減らす設定では、滑った先に指を止めて向きを示す。 */
const swipeClassNames = {
  up: "[--tutorial-swipe-y:-2.25rem] motion-reduce:-translate-y-9",
  down: "[--tutorial-swipe-y:2.25rem] motion-reduce:translate-y-9",
  left: "[--tutorial-swipe-x:-2.25rem] motion-reduce:-translate-x-9",
  right: "[--tutorial-swipe-x:2.25rem] motion-reduce:translate-x-9",
} as const satisfies Record<TutorialCueSwipeDirection, string>;

/**
 * チュートリアルの印と合図。
 * どこまで囲むかと角丸は押す物の形からゲームが決め、置き場所の要素に持たせる。
 *
 * 盤面部品は、押す物（マス・タイルなど）の中に `relative` で角丸を持つ置き場所を置き、その中にこの部品を描く。
 *
 * ```tsx
 * <button type="button" className="relative rounded-md">
 *   {face}
 *   {cue?.kind === "hint" && <TutorialCue kind="mark" recallId={cue.recallId} />}
 *   {cue?.kind === "fitted" && <TutorialCue kind="acknowledgement" id={cue.id} />}
 * </button>
 * ```
 */
export function TutorialCue(props: TutorialCueProps) {
  switch (props.kind) {
    case "mark":
    case "pointer":
      return (
        <>
          {(props.kind === "mark" || props.outlined !== false) && (
            <>
              <span
                aria-hidden="true"
                data-tutorial-cue="mark"
                className={cn(
                  fillPlacementClassName,
                  // 暗い地の上でも輪郭が沈まないよう、外側に地の色の縁を添える。
                  "border-(length:--border-width-strong) border-ring ring-2 ring-background",
                )}
              />
              {props.recallId !== null && (
                <span
                  key={props.recallId}
                  aria-hidden="true"
                  data-tutorial-cue="recall"
                  className={cn(
                    fillPlacementClassName,
                    "border-(length:--border-width-strong) border-foreground",
                    fadeAwayClassName,
                  )}
                />
              )}
              {props.recallId !== null && (
                // 印の無い所を押したことへの応えが見落とされないよう、外から印へ輪を寄せて、目を印へ連れていく。
                <span
                  key={`ring-${props.recallId}`}
                  aria-hidden="true"
                  className={cn(
                    fillPlacementClassName,
                    "animate-tutorial-recall-ring border-(length:--border-width-strong) border-foreground motion-reduce:hidden",
                  )}
                />
              )}
            </>
          )}
          {props.kind === "pointer" && (
            // 指先で、下の縁の中央か、押す物の中央を指す。指先はアイコンの中央より少し左にある。
            // 印の無い所が押されるたびに、指を大きく出し直して、ここだと気づかせる。
            <span
              key={`pointer-${props.recallId}`}
              aria-hidden="true"
              data-tutorial-cue="pointer"
              data-placement={props.placement ?? "below"}
              data-swipe={props.swipe}
              className={cn(
                "pointer-events-none absolute z-10 -ml-3.5 flex size-8 origin-top",
                // 中を指すときは、置いた物を隠さないよう、中央より右下に指先を置く。
                props.placement === "center"
                  ? "top-[60%] left-[60%]"
                  : "top-full left-1/2",
                props.recallId !== null &&
                  "animate-in zoom-in-300 duration-(--duration-slow) ease-celebrate motion-reduce:animate-none",
              )}
            >
              {/* 動きを減らす設定では、指を縁に寄せたまま止める。 */}
              <span
                // 指は盤面の物の中に描くので、盤面の覆いより上へは出せない。抜いた物の外へ出た指が覆いで暗く分かれないよう、指の所も丸く抜く。
                {...{ [TUTORIAL_CUE_HAND_ATTRIBUTE]: "" }}
                className={cn(
                  "flex size-8 motion-reduce:animate-none",
                  props.swipe
                    ? ["animate-tutorial-swipe", swipeClassNames[props.swipe]]
                    : "animate-tutorial-tap",
                )}
              >
                {/* 押す物の中を指すときは波紋を出さない。丸い波紋が、盤面の物（丸いタイルなど）に見えるため。滑るしぐさにも出さない。 */}
                {props.placement !== "center" && !props.swipe && (
                  <span className="absolute -top-2 left-0.5 size-6 animate-tutorial-tap-ripple rounded-full border-(length:--border-width-strong) border-foreground opacity-0 motion-reduce:animate-none" />
                )}
                <Pointer className="size-8 fill-background stroke-foreground drop-shadow-sm" />
              </span>
            </span>
          )}
        </>
      );
    case "achievement":
      return (
        <>
          <span
            aria-hidden="true"
            className={cn(
              fillPlacementClassName,
              "animate-tutorial-achieve-ring border-(length:--border-width-strong) border-foreground motion-reduce:hidden",
            )}
          />
          {/* 仕上げた物を隠さないよう、印は置き場所の上の縁に載せる。 */}
          <span
            aria-hidden="true"
            data-tutorial-cue="achievement"
            className="pointer-events-none absolute -top-3 left-1/2 z-10 -ml-2.5 flex size-5 animate-in items-center justify-center rounded-full bg-foreground text-background duration-(--duration-slow) ease-celebrate zoom-in-0 motion-reduce:animate-none"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </>
      );
    case "acknowledgement":
      return (
        <span
          key={props.id}
          aria-hidden="true"
          data-tutorial-cue="acknowledgement"
          className={cn(
            fillPlacementClassName,
            "border-(length:--border-width-normal) border-foreground",
            fadeAwayClassName,
          )}
        />
      );
  }
}
