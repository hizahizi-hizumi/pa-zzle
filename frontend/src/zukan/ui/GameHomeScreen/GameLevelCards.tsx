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
import {
  type GameLevelCardsArrangement,
  GameLevelPreview,
} from "@/zukan/ui/GameHomeScreen/GameLevelCards/GameLevelPreview";

export type { GameLevelCardsArrangement };

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
  /** 開いているレベル。どのレベルも開いていなければ `null`。 */
  openDifficulty: DifficultyLevel | null;
  arrangement: GameLevelCardsArrangement;
  /** その難易度の盤面の見本を描く。 */
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
};

const tabsListArrangements = {
  row: "scroll",
  list: "list",
} as const satisfies Record<GameLevelCardsArrangement, "scroll" | "list">;

const infoClassNames = {
  row: "flex flex-col gap-1 lg:items-center",
  list: "flex min-w-0 flex-1 flex-col gap-1 lg:flex-none lg:items-center",
} satisfies Record<GameLevelCardsArrangement, string>;

/** カードを1行に並べる幅。クラスの `lg:` と同じ境目にする。 */
const WIDE_MEDIA_QUERY = "(width >= 64rem)";
/** 大きく描く見本の、拡大の上限。 */
const MAX_LIST_PREVIEW_ZOOM = 1.6;

/** 見本の中で実際に描かれているものの幅。見本の外枠は枠いっぱいに広がるので、子を持たない要素の範囲で測る。 */
function measurePreviewContentWidth(frame: Element): number {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const element of frame.querySelectorAll("*")) {
    const {
      width,
      left: elementLeft,
      right: elementRight,
    } = element.getBoundingClientRect();
    if (element.childElementCount > 0 || width === 0) {
      continue;
    }
    left = Math.min(left, elementLeft);
    right = Math.max(right, elementRight);
  }
  return right > left ? right - left : 0;
}

/**
 * lg で大きく描く見本を、どのレベルの見本もカードの幅に収まる大きさまで拡大する。見本の幅はゲームとレベルで違うので、描いた見本を測って決める。
 * 拡大はそのゲームの5枚で同じにし、レベルの間で見本の大きさを比べられるようにする。
 */
function fitListPreviewZoom(list: HTMLElement) {
  list.style.removeProperty("--level-preview-zoom");
  if (!window.matchMedia?.(WIDE_MEDIA_QUERY).matches) {
    return;
  }
  const zooms = [
    ...list.querySelectorAll<HTMLElement>("[data-level-preview-frame]"),
  ].flatMap((frame) => {
    const card = frame.parentElement;
    const contentWidth = measurePreviewContentWidth(frame);
    if (card === null || contentWidth === 0) {
      return [];
    }
    const { paddingLeft, paddingRight } = getComputedStyle(card);
    const cardContentWidth =
      card.clientWidth -
      Number.parseFloat(paddingLeft) -
      Number.parseFloat(paddingRight);
    return [cardContentWidth / contentWidth];
  });
  if (zooms.length === 0) {
    return;
  }
  const zoom = Math.min(MAX_LIST_PREVIEW_ZOOM, ...zooms);
  if (zoom > 1) {
    list.style.setProperty("--level-preview-zoom", zoom.toFixed(2));
  }
}

function scrollCardIntoView(card: Element, behavior: ScrollBehavior) {
  card.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
}

/**
 * ゲームのホームで、遊ぶレベルを選び、その台紙を開くカード。
 * 各カードに、そのレベルで盤面がどう変わるかの見本、5段階の中の位置、レベルの名前、解いた数を示し、切り替えずに全レベルを比べられるようにする。
 * レベルを開いている間は1行に並べ、収まらない幅では横に送る。どのレベルも開いていない間は、台紙の場所を使って見本を大きく描き、狭い幅では縦に並べる。
 * 矢印キーはカードの間でフォーカスを動かすだけにし、選ぶのは押したときと Enter・Space にする。通り過ぎたレベルの台紙を開いて描き直したり、変化を見せ終えたりしない。
 * 開いているカードが送った先にあれば、見える位置へ送る。開くレベルはこの画面を描いたあとに決まり直すことがあるので、利用者がカードを触るまでは決まり直すたびに送る。
 * 端で切れたカードを押したときと、カードを1行に並べ直したときも、選んだカードを見える位置へ送る。
 * まだ見せていない変化のあるレベルには、名前の横に小さな点を付ける。
 */
export function GameLevelCards({
  levels,
  openDifficulty,
  arrangement,
  renderLevelPreview,
}: GameLevelCardsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isTouchedRef = useRef(false);
  const previousArrangementRef = useRef(arrangement);

  useLayoutEffect(() => {
    const isRearranged = previousArrangementRef.current !== arrangement;
    previousArrangementRef.current = arrangement;
    const openCard = listRef.current?.querySelector(
      `[data-difficulty="${openDifficulty}"]`,
    );
    if (!openCard || (isTouchedRef.current && !isRearranged)) {
      return;
    }
    scrollCardIntoView(openCard, "instant");
  }, [openDifficulty, arrangement]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (arrangement !== "list" || list === null) {
      return;
    }
    function fitZoom() {
      if (list !== null) {
        fitListPreviewZoom(list);
      }
    }
    fitZoom();
    window.addEventListener("resize", fitZoom);
    return () => {
      window.removeEventListener("resize", fitZoom);
      list.style.removeProperty("--level-preview-zoom");
    };
  }, [arrangement]);

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
      cardArrangement={tabsListArrangements[arrangement]}
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
              arrangement={arrangement}
              renderLevelPreview={renderLevelPreview}
            />
            <span className={infoClassNames[arrangement]}>
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
