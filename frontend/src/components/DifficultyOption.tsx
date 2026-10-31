import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
import type { DifficultyLevel } from "@/games/difficulty";
import { Link, type Path } from "@/router";

type DifficultyPlayPath = Extract<Path, `/puzzles/${string}/play/:difficulty`>;

type DifficultyOptionProps = {
  /** 選ぶと開くプレイ画面。`:difficulty` に `difficulty` を入れる。 */
  playPath: DifficultyPlayPath;
  difficulty: DifficultyLevel;
  label: string;
  /** その難易度の盤面の見本。 */
  children: ReactNode;
};

/**
 * 難易度選択の1つの選択肢。レベルをピースの帯で示し、ラベルはその補足に下げる。
 * スマートフォンでは横長の行、PC では縦長のカードにする。
 */
export function DifficultyOption({
  playPath,
  difficulty,
  label,
  children,
}: DifficultyOptionProps) {
  return (
    <Link
      to={playPath}
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <span className="relative flex h-16 flex-row items-center justify-start gap-4 rounded-xl border-(length:--border-width-normal) bg-background px-4 transition-colors group-hover:bg-accent/60 group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring lg:h-60 lg:flex-col lg:justify-center lg:gap-6 lg:py-8">
        {/* 一覧で選択肢を並べたとき、ラベルの位置をゲームによらずそろえるため、見本の幅をここで固定する。 */}
        <span className="flex w-32 shrink-0 lg:w-full lg:justify-center">
          {children}
        </span>
        <span className="flex flex-col items-start gap-1 lg:items-center lg:gap-2">
          <DifficultyLevelPieces level={difficulty} />
          <span className="text-supporting text-muted-foreground">{label}</span>
        </span>
        <ChevronRight
          className="absolute right-4 size-5 text-muted-foreground transition-transform duration-(--duration-fast) ease-standard group-hover:translate-x-0.5 lg:hidden"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
