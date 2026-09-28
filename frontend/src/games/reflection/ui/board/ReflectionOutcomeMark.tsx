import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";
import { cn } from "@/lib/utils";

/**
 * `clue` は外周ヒントの中で盤面の大きさに合わせる。`inline` は文中、`figure` は遊び方の図、`badge` は光路の札（文字の大きさに合わせる）。
 * 色は周りの文字色を使う。結果の色（`reflectionOutcomeToneClassNames`）は使う側が与える。
 */
type ReflectionOutcomeMarkSize = "clue" | "inline" | "figure" | "badge";

type ReflectionOutcomeMarkProps = {
  outcome: ReflectionOutcome;
  size: ReflectionOutcomeMarkSize;
};

const sizeClassNames = {
  clue: "size-[clamp(0.625rem,calc(var(--reflection-unit)*0.28),1rem)]",
  inline: "size-3",
  figure: "size-3.5",
  badge: "size-[0.9em]",
} as const satisfies Record<ReflectionOutcomeMarkSize, string>;

/**
 * 外周ヒントの結果の形。結果ごとに色も付けるが、色を見なくても、退出は斜めの矢印、反射は折り返す矢印、吸収は塗りの点で見分ける。
 * 辺によって向きを変えず、遊び方の説明と同じ形で読めるようにする。
 */
export function ReflectionOutcomeMark({
  outcome,
  size,
}: ReflectionOutcomeMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={cn("shrink-0", sizeClassNames[size])}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderReflectionOutcomeShape(outcome)}
    </svg>
  );
}

/** 結果の形。12×12 の座標で描く。 */
export function renderReflectionOutcomeShape(outcome: ReflectionOutcome) {
  switch (outcome) {
    case "exit":
      return (
        <>
          <line x1="2.5" y1="9.5" x2="9.5" y2="2.5" />
          <polyline points="4.5,2.5 9.5,2.5 9.5,7.5" />
        </>
      );
    case "reflect":
      return (
        <>
          <path d="M9 10.5V5.5a3 3 0 0 0-6 0v4.5" />
          <polyline points="1,8 3,10.5 5,8" />
        </>
      );
    case "absorb":
      return <circle cx="6" cy="6" r="3.6" fill="currentColor" stroke="none" />;
  }
}
