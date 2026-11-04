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

/** 出してから少し保ち、線を消す。動きを減らす設定でも、位置や大きさを変えないので同じに見せる。 */
const fadeAwayClassName =
  "fill-mode-forwards animate-out fade-out-0 delay-(--duration-slow) duration-(--duration-slow) ease-standard";

/**
 * チュートリアルの印と合図。`DESIGN.md` の「チュートリアルの印」の見せ方を全ゲームで共有する。決め手は印を付けず、沈めずに残すことで示す（`TutorialSubduable`）。
 * どこまで囲むかと角丸は押す物の形からゲームが決め、置き場所の要素に持たせる。
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
