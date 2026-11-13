import { Check, X } from "lucide-react";

type CandidateMarkProps = {
  allowed: boolean;
  /**
   * - `legend`: 凡例の記号として、判定の記号（`HowToPlayVerdict` の ✓ / ✕）と同じ大きさと太さで描く。
   * - `cell`: 盤面のマスの上に置く印として、置き場所いっぱいに描く。マスの大きさに合わせて置き場所が決める。
   */
  size: "legend" | "cell";
};

/** 判定の記号と同じ線の太さ。 */
const MARK_STROKE_WIDTH = 2.5;

/** 盤面の印の下に敷く、地の色の縁取りの太さ。下の道の線を記号の周りだけ隠す。 */
const HALO_STROKE_WIDTH = 7;

/**
 * 手ごとに通れるかの印。判定の ✓ / ✕ と同じ字形・太さ・文字の色で描き、凡例・判定・盤面の印で記号の形をそろえる。
 * 盤面では、記号の下に地の色の太い縁取りを敷き、下の道の線を記号の周りだけ隠して、記号だけを読ませる。
 * 本番の×（阻まれた手、道の色で太く点く）とは色と太さで見分けられ、×が点いている間は盤面がそのマスの印を消す。
 */
export function CandidateMark({ allowed, size }: CandidateMarkProps) {
  const Mark = allowed ? Check : X;
  if (size === "legend") {
    return (
      <Mark
        aria-hidden
        className="size-4 shrink-0"
        strokeWidth={MARK_STROKE_WIDTH}
      />
    );
  }
  return (
    <span className="relative flex size-full">
      <Mark
        aria-hidden
        className="absolute inset-0 size-full text-background"
        strokeWidth={HALO_STROKE_WIDTH}
      />
      <Mark
        aria-hidden
        className="absolute inset-0 size-full text-foreground"
        strokeWidth={MARK_STROKE_WIDTH}
      />
    </span>
  );
}
