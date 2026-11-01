import { memo, type ReactNode } from "react";

import type { DifficultyLevel } from "@/games/difficulty";

/**
 * カードの並べ方。
 * - `row`: レベルを開いている間。カードを1行に並べ、台紙に場所を譲るよう見本を小さく描く。
 * - `list`: どのレベルも開いていない間。台紙の場所を使い、見本を大きく描く。
 */
export type GameLevelCardsArrangement = "row" | "list";

type GameLevelPreviewProps = {
  difficulty: DifficultyLevel;
  arrangement: GameLevelCardsArrangement;
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
};

// 見本はゲームが固定の大きさで描くので、枠の大きさをここで決め、`zoom` で拡大・縮小する。`zoom` は縮めても線を画素に合わせて描き直すので、細い枠線もにじまない。
// lg より狭い幅の見本は 132×56px、lg の見本は 170×72px の中に収まるように描かれている。lg の見本は上下に空きを持つので、枠で詰める。
// row では、lg より狭い幅はカードの幅に合わせて枠ごと縮める。
// list では、lg より狭い幅は画面の高さに合わせて枠ごと大きくし、lg は枠の大きさを保ったまま、見本だけをカードの幅に収まる大きさ（`--level-preview-zoom`、上限 1.6 倍）にする。
const frameClassNames = {
  row: "flex h-14 w-[132px] items-center max-lg:[zoom:0.8] max-lg:@min-[119px]/level-card:[zoom:0.9] max-lg:@min-[132px]/level-card:[zoom:1] lg:h-[72px] lg:w-full lg:justify-center",
  list: "flex h-14 w-[132px] shrink-0 items-center max-lg:[zoom:0.8] max-lg:[@media(min-height:640px)]:[zoom:1] max-lg:[@media(min-height:760px)]:[zoom:1.5] lg:h-[116px] lg:w-full lg:justify-center",
} satisfies Record<GameLevelCardsArrangement, string>;

const previewClassNames = {
  row: "flex size-full items-center lg:h-[72px] lg:w-[170px] lg:shrink-0 lg:justify-center",
  list: "flex size-full items-center lg:h-[72px] lg:w-[170px] lg:shrink-0 lg:justify-center lg:[zoom:var(--level-preview-zoom,1)]",
} satisfies Record<GameLevelCardsArrangement, string>;

/**
 * レベルのカードに描く、その難易度の盤面の見本。枠の大きさをゲームによらずそろえ、カードを並べたときに名前と数の位置をそろえる。
 * 見本は難易度だけで決まるので、カードの数が変わるたびに描き直さない。
 */
function GameLevelPreviewContent({
  difficulty,
  arrangement,
  renderLevelPreview,
}: GameLevelPreviewProps) {
  return (
    <span
      aria-hidden="true"
      data-level-preview-frame=""
      className={frameClassNames[arrangement]}
    >
      <span className={previewClassNames[arrangement]}>
        {renderLevelPreview(difficulty)}
      </span>
    </span>
  );
}

export const GameLevelPreview = memo(GameLevelPreviewContent);
