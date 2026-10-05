import { useId } from "react";

import { createJigsawStrip } from "@/components/DifficultyLevelPieces/jigsaw-strip";
import type { DifficultyLevel } from "@/games/difficulty";

type DifficultyLevelPiecesProps = {
  level: DifficultyLevel;
};

/**
 * 5マスのジグソーの帯。左から、レベルの数だけピースが埋まっている。
 * 小さく表示する記号なので縮小で兼用せず、スマホの行とPCのカードで1単位=1pxの原図を描き分ける。
 */
const artworks = [
  {
    key: "compact",
    className: "lg:hidden",
    strip: createJigsawStrip(16),
    seamGap: 1,
  },
  {
    key: "large",
    className: "hidden lg:block",
    strip: createJigsawStrip(20),
    // 1倍密度の画面で継ぎ目がピクセルの境目をまたいでにじまないよう、整数幅にする。
    seamGap: 2,
  },
] as const;

export function DifficultyLevelPieces({ level }: DifficultyLevelPiecesProps) {
  const maskIdPrefix = useId();
  const filledCount = Number(level);

  return (
    <span aria-hidden="true" className="flex">
      {artworks.map(({ key, className, strip, seamGap }) => {
        const maskId = `${maskIdPrefix}-${key}`;
        return (
          <svg
            key={key}
            width={strip.width}
            height={strip.height}
            viewBox={`0 0 ${strip.width} ${strip.height}`}
            className={className}
          >
            <defs>
              {/* 継ぎ目を背景色で塗らず抜くことで、カードのホバー色やテーマに関係なく隙間に見せる。 */}
              <mask id={maskId}>
                <rect width={strip.width} height={strip.height} fill="#fff" />
                <g fill="none" stroke="#000" strokeWidth={seamGap}>
                  {strip.seams.map((seam) => (
                    <path key={seam} d={seam} />
                  ))}
                </g>
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
              {strip.cells.map((cell, index) => (
                <path
                  key={cell}
                  d={cell}
                  className={
                    index < filledCount
                      ? "fill-muted-foreground"
                      : "fill-border"
                  }
                />
              ))}
            </g>
          </svg>
        );
      })}
    </span>
  );
}
