import {
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import { prefersReducedMotion } from "@/lib/motion";
import { GameLevelPreview } from "@/zukan/ui/GameHomeScreen/GameLevelCards/GameLevelPreview";

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
  /** 開いているレベル。 */
  openDifficulty: DifficultyLevel;
  /** その難易度の盤面の見本を描く。 */
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
};

function scrollCardIntoView(card: Element, behavior: ScrollBehavior) {
  card.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
}

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開くカード。
 * 各カードに、そのレベルで盤面がどう変わるかの見本、5段階の中の位置、レベルの名前、解いた数を示し、切り替えずに全レベルを比べられるようにする。
 * 1行に並べ、収まらない幅では横に送る。
 * 矢印キーはカードの間でフォーカスを動かすだけにし、選ぶのは押したときと Enter・Space にする。通り過ぎたレベルの台紙を開いて描き直したり、変化を見せ終えたりしない。
 * 開いているカードが送った先にあれば、見える位置へ送る。開くレベルはこの画面を描いたあとに決まり直すことがあるので、利用者がカードを触るまでは決まり直すたびに送る。
 * 端で切れたカードを押したときも、押したカードを見える位置へ送る。
 * まだ見せていない変化のあるレベルには、名前の横に小さな点を付ける。
 */
export function GameLevelCards({
  levels,
  openDifficulty,
  renderLevelPreview,
}: GameLevelCardsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isTouchedRef = useRef(false);

  useLayoutEffect(() => {
    const openCard = listRef.current?.querySelector(
      `[data-difficulty="${openDifficulty}"]`,
    );
    if (!openCard || isTouchedRef.current) {
      return;
    }
    scrollCardIntoView(openCard, "instant");
  }, [openDifficulty]);

  function markTouched() {
    isTouchedRef.current = true;
  }

  function handleCardClick(event: MouseEvent<HTMLButtonElement>) {
    scrollCardIntoView(
      event.currentTarget,
      prefersReducedMotion() ? "instant" : "smooth",
    );
  }

  return (
    <TabsList
      ref={listRef}
      layout="card"
      aria-label="レベル"
      onPointerDown={markTouched}
      onWheel={markTouched}
      onKeyDown={markTouched}
    >
      {levels.map(
        ({ difficulty, problemCount, solvedCount, hasUnseenChanges }) => (
          <TabsTrigger
            key={difficulty}
            value={difficulty}
            data-difficulty={difficulty}
            onClick={handleCardClick}
          >
            <GameLevelPreview
              difficulty={difficulty}
              renderLevelPreview={renderLevelPreview}
            />
            <span className="flex flex-col gap-1 lg:items-center">
              <DifficultyLevelPieces level={difficulty} />
              <span className="flex items-baseline justify-between gap-1 text-meta lg:justify-center lg:gap-2">
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
                  <span aria-hidden="true">
                    {solvedCount} / {problemCount}
                  </span>
                  <span className="sr-only">
                    、{problemCount}問中{solvedCount}問を解いた
                  </span>
                  {hasUnseenChanges && (
                    <span className="sr-only">、前回から変化あり</span>
                  )}
                </span>
              </span>
            </span>
          </TabsTrigger>
        ),
      )}
    </TabsList>
  );
}
