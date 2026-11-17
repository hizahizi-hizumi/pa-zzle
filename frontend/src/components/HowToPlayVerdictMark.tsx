import { Check, X } from "lucide-react";

/** 記号が示す答え。✓ はできる・通る、✕ はできない・弾かれる。 */
export type HowToPlayVerdictMarkKind = "allowed" | "disallowed";

/**
 * 記号の置き場所。どれも同じ字形と線の太さで描き、言葉の行・凡例・盤面の印で記号の形をそろえる。
 * - `line`: 判定・凡例・起きたことの1行の頭。16px の場所に描く。
 * - `board-halo`: 盤面の線の上に置く印。置き場所いっぱいに描き、地の色の太い縁取りを下に敷いて、下の線を記号の周りだけ隠す。
 * - `board-tag`: 盤面の物の上に置く札。置き場所いっぱいの地の色の丸に記号を載せ、下の物を札の分だけ隠す。
 */
export type HowToPlayVerdictMarkPlacement = "line" | "board-halo" | "board-tag";

type HowToPlayVerdictMarkProps = {
  verdict: HowToPlayVerdictMarkKind;
  placement?: HowToPlayVerdictMarkPlacement;
};

const marks = {
  allowed: Check,
  disallowed: X,
} as const satisfies Record<HowToPlayVerdictMarkKind, typeof Check>;

/** 判定の記号の線の太さ。 */
const MARK_STROKE_WIDTH = 2.5;

/** 盤面の印の下に敷く、地の色の縁取りの太さ。 */
const HALO_STROKE_WIDTH = 7;

/**
 * 判定の ✓ / ✕ の記号。読み上げは添える言葉や盤面の読み上げ名が受け持つので、記号は読み上げない。
 * 色は置き場所の文字の色を受け継ぎ、判定の ✕ を違反の色にする所でもそのまま使える。
 */
export function HowToPlayVerdictMark({
  verdict,
  placement = "line",
}: HowToPlayVerdictMarkProps) {
  const Mark = marks[verdict];
  if (placement === "line") {
    return (
      <Mark
        aria-hidden
        data-how-to-play-verdict-mark={verdict}
        className="size-4 shrink-0"
        strokeWidth={MARK_STROKE_WIDTH}
      />
    );
  }
  if (placement === "board-halo") {
    return (
      <span
        aria-hidden="true"
        data-how-to-play-verdict-mark={verdict}
        className="relative flex size-full"
      >
        <Mark
          className="absolute inset-0 size-full text-background"
          strokeWidth={HALO_STROKE_WIDTH}
        />
        <Mark
          className="absolute inset-0 size-full text-foreground"
          strokeWidth={MARK_STROKE_WIDTH}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-how-to-play-verdict-mark={verdict}
      className="flex size-full items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border"
    >
      <Mark className="size-[70%]" strokeWidth={MARK_STROKE_WIDTH} />
    </span>
  );
}
