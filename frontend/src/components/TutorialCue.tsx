import { cn } from "@/lib/utils";

/**
 * - `mark`: 次に押す所の印。`recallId` は印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 * - `acknowledgement`: 本番に同じ合図が無いときの、手が成立した瞬間の応え。`id` が変わるとやり直す。
 */
type TutorialCueProps =
  | { kind: "mark"; recallId: number | null }
  | { kind: "acknowledgement"; id: number };

/** 押す物の形に沿わせるため、置き場所の要素いっぱいに、その要素と同じ角丸で描く。 */
const fillPlacementClassName =
  "pointer-events-none absolute inset-0 rounded-[inherit]";

/** 動きを減らす設定でも、位置や大きさを変えないので同じに見せる。 */
const fadeAwayClassName =
  "fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard";

/**
 * チュートリアルの印と合図。ゲームは印と合図をこの部品だけで描く。決め手は印ではなく `TutorialSpotlight` で示す。
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
