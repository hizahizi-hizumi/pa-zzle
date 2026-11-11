import { Check, Pointer } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * - `mark`: 次に押す所の印。`recallId` は印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 * - `pointer`: 次に押す所を、輪郭の印に加えて、押すしぐさをする指で指す。画面を覆わずに手を引く画面で使う。`recallId` は `mark` と同じ。
 * - `acknowledgement`: 本番に同じ合図が無いときの、手が成立した瞬間の応え。`id` が変わるとやり直す。
 * - `achievement`: 本番に同じ合図が無いときの、盤面の一部を仕上げたことへの応え。輪郭が一度広がって消え、仕上げた印を残す。
 */
type TutorialCueProps =
  | { kind: "mark"; recallId: number | null }
  | { kind: "pointer"; recallId: number | null }
  | { kind: "acknowledgement"; id: number }
  | { kind: "achievement" };

/** 押す物の形に沿わせるため、置き場所の要素いっぱいに、その要素と同じ角丸で描く。 */
const fillPlacementClassName =
  "pointer-events-none absolute inset-0 rounded-[inherit]";

/** 出してから少し保ち、線を消す。動きを減らす設定でも、位置や大きさを変えないので同じに見せる。 */
const fadeAwayClassName =
  "fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard";

/**
 * チュートリアルの印と合図。全ゲームで同じ見せ方にするため、印と合図はこの部品だけで描き、ゲームごとの点線・発光・矢印・バッジ・独自の色を足さない。
 * 画面全体に覆いを重ねる画面（`TutorialOverlay`）では、決め手には印を付けず、覆いから抜いて元の明るさで見せることで示す（`TutorialSpotlight`）。
 * どこまで囲むかと角丸は押す物の形からゲームが決め、置き場所の要素に持たせる。
 *
 * 盤面部品は、押す物（マス・タイルなど）の中に `relative` で角丸を持つ置き場所を置き、その中にこの部品を描く。
 * 盤面部品は本番では合図を受け取らないので、合図を任意の props（例: `cues`）で受け取り、本番の見た目を変えない。
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
          <span
            aria-hidden="true"
            data-tutorial-cue="mark"
            className={cn(
              fillPlacementClassName,
              "border-(length:--border-width-strong) border-ring",
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
          {props.kind === "pointer" && (
            // 押す物を隠さないよう、指は置き場所のすぐ下から、指先で下の縁の中央を指す。指先はアイコンの中央より少し左にある。
            // 印の無い所が押されるたびに、指を大きく出し直して、ここだと気づかせる。
            <span
              key={`pointer-${props.recallId}`}
              aria-hidden="true"
              data-tutorial-cue="pointer"
              className={cn(
                "pointer-events-none absolute top-full left-1/2 z-10 -ml-3.5 flex size-8 origin-top",
                props.recallId !== null &&
                  "animate-in zoom-in-300 duration-(--duration-slow) ease-celebrate motion-reduce:animate-none",
              )}
            >
              {/* 動きを減らす設定では、指を縁に寄せたまま止める。 */}
              <span className="flex size-8 animate-tutorial-tap motion-reduce:animate-none">
                <span className="absolute -top-2 left-0.5 size-6 animate-tutorial-tap-ripple rounded-full border-(length:--border-width-strong) border-foreground opacity-0 motion-reduce:animate-none" />
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
