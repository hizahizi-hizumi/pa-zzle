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
 * チュートリアルの印と合図。全ゲームで同じ見せ方にするため、印と合図はこの部品だけで描き、ゲームごとの点線・発光・矢印・バッジ・独自の色を足さない。
 * 決め手には印を付けず、手を引く間に画面全体の覆いから、押す所より一段暗く抜いて見せることで示す（`TutorialSpotlight` の `clue`）。
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
