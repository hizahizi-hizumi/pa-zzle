import { type ReactNode, useLayoutEffect, useRef } from "react";

import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
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
  /** その難易度の盤面の見本を描く。 */
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
};

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開くカード。
 * 各カードに、そのレベルで盤面がどう変わるかの見本、5段階の中の位置、レベルの名前、解いた数を示し、切り替えずに全レベルを比べられるようにする。
 * 収まらない幅では横に送り、開いたときに開いているカードが見えるよう送っておく。
 * まだ見せていない変化のあるレベルには、名前の横に小さな点を付ける。
 */
export function GameLevelCards({
  levels,
  renderLevelPreview,
}: GameLevelCardsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 最後に遊んだレベルや選んだ問題のレベルが、横に送った先にあっても見えるようにする。開いたあとに選んだカードへは送らない。
  useLayoutEffect(() => {
    const list = listRef.current;
    const openCard = list?.querySelector('[data-state="active"]');
    if (!list || !openCard) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const cardRect = openCard.getBoundingClientRect();
    if (cardRect.right > listRect.right) {
      list.scrollLeft += cardRect.right - listRect.right;
    }
  }, []);

  return (
    // カードの選んだ輪郭が送る領域の端で切れないよう、領域が取る余白の分だけ外へ広げる。
    <div className="-m-1">
      <TabsList ref={listRef} layout="card" aria-label="レベル">
        {levels.map(
          ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
            <TabsTrigger key={difficulty} value={difficulty}>
              {/* カードを並べたとき、名前と数の位置をゲームによらずそろえるため、見本の枠の大きさをここで決める。 */}
              <span
                aria-hidden="true"
                className="flex h-14 w-36 items-center lg:h-28 lg:w-full lg:justify-center"
              >
                {renderLevelPreview(difficulty)}
              </span>
              <span className="flex lg:justify-center">
                <DifficultyLevelPieces level={difficulty} />
              </span>
              <span className="flex items-baseline justify-between gap-2 text-meta">
                <span className="relative font-medium">
                  {getDifficultyLabel(difficulty)}
                  {hasUnseenChanges && (
                    <span
                      aria-hidden="true"
                      data-unseen-change-mark=""
                      className="absolute top-0.5 -right-2 size-1.5 rounded-full bg-foreground"
                    />
                  )}
                </span>
                <span className="font-normal text-muted-foreground tabular-nums">
                  <span className="sr-only">、解いた問題 </span>
                  {solvedCount} / {problemCount}
                  {hasUnseenChanges && (
                    <span className="sr-only">、前回から変化あり</span>
                  )}
                </span>
              </span>
            </TabsTrigger>
          ),
        )}
      </TabsList>
    </div>
  );
}
