import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";

/** タブに示す、1つのレベルの台紙の進み具合。 */
export type ZukanLevelTab = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 今示す解いた数。変化をまだ見せていないレベルでは前回の数を示す。 */
  solvedCount: number;
  /** 前回図鑑を見たときからの変化を、まだ見せていないか。 */
  hasUnseenChanges: boolean;
};

type ZukanLevelTabsProps = {
  /** 問題のある難易度のタブ。難易度の昇順。 */
  levels: readonly ZukanLevelTab[];
};

/**
 * 台紙を切り替えるレベルのタブ。各タブにレベルの解いた数を添え、切り替えずに全レベルの進み具合が分かるようにする。
 * スマートフォンの幅でも全レベルを1行に収めるよう、名前と数を2段に積む。
 * まだ見せていない変化のあるレベルには、名前の横に小さな点を付ける。
 */
export function ZukanLevelTabs({ levels }: ZukanLevelTabsProps) {
  return (
    <TabsList layout="stacked" aria-label="レベル">
      {levels.map(
        ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
          <TabsTrigger key={difficulty} value={difficulty}>
            <span className="relative">
              {getDifficultyLabel(difficulty)}
              {hasUnseenChanges && (
                <span
                  aria-hidden="true"
                  data-unseen-change-mark=""
                  className="absolute top-0.5 -right-2 size-1.5 rounded-full bg-foreground"
                />
              )}
            </span>
            <span className="text-meta font-normal text-muted-foreground tabular-nums">
              <span className="sr-only">、解いた問題 </span>
              {solvedCount} / {problemCount}
              {hasUnseenChanges && (
                <span className="sr-only">、前回から変化あり</span>
              )}
            </span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
