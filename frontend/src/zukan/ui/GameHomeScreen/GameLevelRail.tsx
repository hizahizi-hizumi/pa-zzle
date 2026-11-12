import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";

/** 帯に示す、1つのレベルの台紙の進み具合。 */
export type GameLevel = {
  difficulty: DifficultyLevel;
  problemCount: number;
  /** 今示す解いた数。変化をまだ見せていないレベルでは前回の数を示す。 */
  solvedCount: number;
  /** 前回図鑑を見たときからの変化を、まだ見せていないか。 */
  hasUnseenChanges: boolean;
};

type GameLevelRailProps = {
  /** 問題のある難易度。難易度の昇順。 */
  levels: readonly GameLevel[];
};

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開く帯。
 * レベルを大きな数字で並べ、各レベルの解いた数を添えて、切り替えずに全レベルを比べられるようにする。
 * スマートフォンでも横へ送らずに全レベルが見えるよう、幅を等分して1行に並べる。どのレベルも同じ姿で示し、推奨として強調しない。
 * 矢印キーは帯の中でフォーカスを動かすだけにし、選ぶのは押したときと Enter・Space にする。通り過ぎたレベルの台紙を開いて描き直したり、変化を見せ終えたりしない。
 * まだ見せていない変化のあるレベルには、数字の右肩に小さな点を付ける。
 */
export function GameLevelRail({ levels }: GameLevelRailProps) {
  return (
    <TabsList layout="rail" aria-label="レベル">
      {levels.map(
        ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
          <TabsTrigger key={difficulty} value={difficulty}>
            <span className="relative flex items-baseline gap-x-1">
              <span aria-hidden="true" className="text-[0.625rem] font-medium">
                レベル
              </span>
              <span
                aria-hidden="true"
                className="font-ui text-[1.375rem] leading-6 font-bold tabular-nums"
              >
                {difficulty}
              </span>
              <span className="sr-only">{getDifficultyLabel(difficulty)}</span>
              {hasUnseenChanges && (
                <span
                  aria-hidden="true"
                  data-unseen-change-mark=""
                  className="absolute -top-0.5 -right-2 size-1.5 rounded-full bg-foreground"
                />
              )}
            </span>
            <span className="text-meta font-normal tabular-nums">
              <span aria-hidden="true">
                {solvedCount}
                <span className="opacity-60"> / {problemCount}</span>
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
