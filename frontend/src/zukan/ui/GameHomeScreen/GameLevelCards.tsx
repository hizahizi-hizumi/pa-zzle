import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import { ZukanLevelMosaic } from "@/zukan/ui/GameHomeScreen/GameLevelCards/ZukanLevelMosaic";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

/** カードに示す、1つのレベルの台紙の進み具合。 */
export type GameLevelCard = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 今示す解いた数。変化をまだ見せていないレベルでは前回の数を示す。 */
  solvedCount: number;
  /** そのレベルの全問の、今示す状態。番号の順。変化をまだ見せていない問題は前回の状態を示す。 */
  statuses: readonly ZukanProblemStatus[];
  /** そのレベルの台紙の列の数。縮図を台紙と同じ並びで描くのに使う。 */
  columnCount: number;
  /** 前回図鑑を見たときからの変化を、まだ見せていないか。 */
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  /** 問題のある難易度のカード。難易度の昇順。 */
  levels: readonly GameLevelCard[];
};

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開くカード。
 * 各カードに、そのレベルの台紙を同じ並びのまま縮めた縮図、レベルの名前、解いた数を示し、切り替えずに全レベルの跡を比べられるようにする。
 * どの画面幅でも全レベルを1行に等分して並べ、横に送らせない。台紙を広く見せるよう、カードは縮図と、名前と解いた数だけに収める。
 * 名前と解いた数は、狭いカードでは2行に、収まる幅では1行に並べる。全問の数は、ごく狭い画面では省く。
 * 矢印キーはカードの間でフォーカスを動かすだけにし、選ぶのは押したときと Enter・Space にする。通り過ぎたレベルの台紙を開いて描き直したり、変化を見せ終えたりしない。
 * まだ見せていない変化のあるレベルには、カードの右上に小さな点を付ける。
 */
export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList layout="card" aria-label="レベル" data-screen-content="">
      {levels.map(
        ({
          difficulty,
          problemCount,
          solvedCount,
          statuses,
          columnCount,
          hasUnseenChanges,
        }) => (
          <TabsTrigger
            key={difficulty}
            value={difficulty}
            data-difficulty={difficulty}
          >
            <span className="relative block">
              <ZukanLevelMosaic statuses={statuses} columnCount={columnCount} />
              {hasUnseenChanges && (
                <span
                  aria-hidden="true"
                  data-unseen-change-mark=""
                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground ring-2 ring-background"
                />
              )}
            </span>
            <span className="flex flex-col text-meta whitespace-nowrap md:flex-row md:items-baseline md:justify-between md:gap-1">
              <span className="font-medium">
                {getDifficultyLabel(difficulty)}
              </span>
              <span className="font-normal text-muted-foreground tabular-nums">
                <span aria-hidden="true">
                  {solvedCount}
                  <span className="max-[359px]:hidden">/{problemCount}</span>
                </span>
                <span className="sr-only">
                  、{problemCount}問中{solvedCount}問を解いた
                </span>
                {hasUnseenChanges && (
                  <span className="sr-only">、前回から変化あり</span>
                )}
              </span>
            </span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
