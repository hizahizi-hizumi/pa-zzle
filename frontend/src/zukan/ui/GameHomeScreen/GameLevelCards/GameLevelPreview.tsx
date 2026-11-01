import { memo, type ReactNode } from "react";

import type { DifficultyLevel } from "@/games/difficulty";

type GameLevelPreviewProps = {
  difficulty: DifficultyLevel;
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
};

/**
 * レベルのカードに描く、その難易度の盤面の見本。枠の大きさをゲームによらずそろえ、カードを並べたときに名前と数の位置をそろえる。
 * 見本は難易度だけで決まるので、カードの数が変わるたびに描き直さない。
 */
function GameLevelPreviewContent({
  difficulty,
  renderLevelPreview,
}: GameLevelPreviewProps) {
  return (
    // 見本はゲームが固定の大きさで描くので、枠の大きさをここで決め、`zoom` で縮める。`zoom` は縮めても線を画素に合わせて描き直すので、細い枠線もにじまない。
    // lg より狭い幅の見本は 132×56px、lg の見本は 170×72px の中に収まるように描かれている。lg の見本は上下に空きを持つので、枠で詰める。
    // lg より狭い幅では、カードの幅に合わせて枠ごと縮める。
    <span
      aria-hidden="true"
      className="flex h-14 w-[132px] items-center max-lg:[zoom:0.8] max-lg:@min-[119px]/level-card:[zoom:0.9] max-lg:@min-[132px]/level-card:[zoom:1] lg:h-[72px] lg:w-full lg:justify-center"
    >
      <span className="flex size-full items-center lg:h-[72px] lg:w-[170px] lg:shrink-0 lg:justify-center">
        {renderLevelPreview(difficulty)}
      </span>
    </span>
  );
}

export const GameLevelPreview = memo(GameLevelPreviewContent);
