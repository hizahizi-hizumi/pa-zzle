import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";

/** カードに示す、1つのレベルの台紙の進み具合。 */
export type GameLevelCard = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 今示す解いた数。変化をまだ見せていないレベルでは前回の数を示す。 */
  solvedCount: number;
  /** 前回図鑑を見たときからの変化を、まだ見せていないか。 */
  hasUnseenChanges: boolean;
};

type GameLevelCardsProps = {
  /** 問題のある難易度のカード。難易度の昇順。 */
  levels: readonly GameLevelCard[];
};

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開くカード。
 * 各カードにレベルの名前と解いた数を示し、切り替えずに全レベルを比べられるようにする。5段階のどこかは、並びの位置で示す。
 * スマートフォンでも横へ送らずに全レベルが見えるよう、画面の幅を等分して1行に並べる。
 * 矢印キーはカードの間でフォーカスを動かすだけにし、選ぶのは押したときと Enter・Space にする。通り過ぎたレベルの台紙を開いて描き直したり、変化を見せ終えたりしない。
 * まだ見せていない変化のあるレベルには、レベルの名前の右肩に小さな点を付ける。
 */
export function GameLevelCards({ levels }: GameLevelCardsProps) {
  return (
    <TabsList layout="card" aria-label="レベル">
      {levels.map(
        ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
          <TabsTrigger key={difficulty} value={difficulty}>
            <span className="relative font-medium">
              {getDifficultyLabel(difficulty)}
              {hasUnseenChanges && (
                <span
                  aria-hidden="true"
                  data-unseen-change-mark=""
                  className="absolute -top-0.5 -right-2 size-1.5 rounded-full bg-foreground"
                />
              )}
            </span>
            <span className="font-normal text-foreground/65 tabular-nums">
              <span aria-hidden="true">
                {solvedCount}/{problemCount}
              </span>
              <span className="sr-only">
                、{problemCount}問中{solvedCount}問を解いた
              </span>
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
