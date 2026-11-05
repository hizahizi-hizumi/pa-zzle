import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

import { playGameSelectSound } from "@/components/app-decision-sound";
import { GamePictogram } from "@/components/GamePictogram";
import { SettingsButton } from "@/components/SettingsButton";
import { Badge } from "@/components/ui/badge";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { Path } from "@/router";

type GameSelectionGame = {
  name: string;
  pictogramSvg: string;
  to: Path;
};

/** 選んでいるゲームの続き。ゲームのホームを開いたときに開くレベルと、そのレベルの挑戦中の問題の数。 */
export type GameSelectionContinuation = {
  difficulty: DifficultyLevel;
  attemptedCount: number;
};

type GameSelectionGalleryProps = {
  games: readonly GameSelectionGame[];
  recordsTo: Path;
  /** 選んでいるゲームの、並びの中の位置。 */
  selectedIndex: number;
  /** 選んでいるゲームの続き。そのゲームを遊んだことが無ければ `null`。 */
  continuation: GameSelectionContinuation | null;
  onSelect: (index: number) => void;
};

function formatContinuation({
  difficulty,
  attemptedCount,
}: GameSelectionContinuation): string {
  const level = getDifficultyLabel(difficulty);
  return attemptedCount > 0 ? `${level} ・ 挑戦中 ${attemptedCount}問` : level;
}

/** 並びの中で `item` を見える位置へ送るのに要る、横の送り量。並びの端の余白（scroll-padding）を空ける。 */
function findScrollIntoListDelta(list: Element, item: Element): number {
  const listRect = list.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const padding = Number.parseFloat(getComputedStyle(list).scrollPaddingLeft);
  const inset = Number.isNaN(padding) ? 0 : padding;
  if (itemRect.left < listRect.left + inset) {
    return itemRect.left - listRect.left - inset;
  }
  if (itemRect.right > listRect.right - inset) {
    return itemRect.right - listRect.right + inset;
  }
  return 0;
}

/**
 * アプリのホーム。選んでいるゲームのピクトグラムと名前を大きく示してそのゲームのホームへの入口にし、全ゲームを選ぶ並びを下に置く。
 * 選んでいるゲームの名前の下に、そのゲームの続きを小さな枠で添える。続きの行の高さは続きが無くても取っておき、ゲームを切り替えても名前とピクトグラムを動かさない。
 * 利用者が並びを触るまでは、選んでいるゲームを並びの見える位置へ送る。
 */
export function GameSelectionGallery({
  games,
  recordsTo,
  selectedIndex,
  continuation,
  onSelect,
}: GameSelectionGalleryProps) {
  const selectedGame = games[selectedIndex] ?? games[0];
  const continuationId = useId();
  const isTouchedRef = useRef(false);

  function selectGame(index: number) {
    if (index !== selectedIndex) {
      playGameSelectSound();
    }
    onSelect(index);
  }
  function markTouched() {
    isTouchedRef.current = true;
  }
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const [scrollbar, setScrollbar] = useState({ size: 1, offset: 0 });

  const updateOverflow = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const maxScrollLeft = list.scrollWidth - list.clientWidth;
    const start = list.scrollLeft > 1;
    const end = list.scrollLeft < maxScrollLeft - 1;
    setOverflow((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
    setScrollbar({
      size: list.clientWidth / list.scrollWidth,
      offset: list.scrollLeft / list.scrollWidth,
    });
  }, []);

  useEffect(() => {
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [updateOverflow]);

  // 並びの中だけを横へ送り、低い画面でページを縦に送らないよう scrollIntoView は使わない。
  useLayoutEffect(() => {
    const list = listRef.current;
    const selectedButton = list?.children[selectedIndex];
    if (!list || !selectedButton || isTouchedRef.current) {
      return;
    }
    list.scrollLeft += findScrollIntoListDelta(list, selectedButton);
  }, [selectedIndex]);

  if (!selectedGame) {
    return null;
  }

  return (
    <section className="grid min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] grid-rows-[29.375rem_minmax(0,1fr)] bg-background sm:grid-rows-[minmax(0,1fr)_14.375rem]">
      <div className="relative min-h-0 bg-muted/30">
        <h1 className="absolute inset-x-0 top-0 z-10 flex h-[4.5rem] items-center justify-center border-b-(length:--border-width-normal) bg-background text-screen-title sm:h-20">
          パズル選択
        </h1>
        <div className="absolute top-0 right-3 z-20 flex h-[4.5rem] items-center sm:right-6 sm:h-20 sm:gap-1">
          <SettingsButton />
          <Link
            to={recordsTo}
            className="flex h-full items-center px-2 text-supporting font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            記録
          </Link>
        </div>

        <Link
          to={selectedGame.to}
          aria-label={`${selectedGame.name}を遊ぶ`}
          aria-describedby={continuation ? continuationId : undefined}
          onClick={playGameSelectSound}
          className="flex h-full flex-col items-center justify-center transition-colors duration-(--duration-slow) hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="size-[10.625rem] p-4 sm:size-[14.0625rem] sm:p-6">
            <GamePictogram svg={selectedGame.pictogramSvg} />
          </span>
          <span className="mt-2 text-heading sm:mt-3">{selectedGame.name}</span>
          <span className="mt-2 flex h-6 items-center">
            {continuation && (
              <Badge id={continuationId} variant="outline">
                {formatContinuation(continuation)}
              </Badge>
            )}
          </span>
        </Link>
      </div>

      <nav
        aria-label="パズル一覧"
        className="min-h-0 overflow-hidden border-t-(length:--border-width-normal) bg-background pt-4 sm:flex sm:items-center sm:px-[max(calc(var(--spacing)*6),calc((100vw-73.75rem)/2))] sm:py-6"
      >
        <div className="w-full">
          <div
            ref={listRef}
            onScroll={updateOverflow}
            onPointerDown={markTouched}
            onWheel={markTouched}
            onKeyDown={markTouched}
            data-overflow-start={overflow.start}
            data-overflow-end={overflow.end}
            style={{
              maskImage: `linear-gradient(to right, ${
                overflow.start ? "transparent, black 1.5rem" : "black, black"
              }, ${overflow.end ? "black calc(100% - 1.5rem), transparent" : "black, black"})`,
            }}
            className="flex w-full scroll-px-4 snap-x snap-proximity gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {games.map((game, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={game.to}
                  type="button"
                  aria-label={`${game.name}を選択`}
                  aria-pressed={isSelected}
                  onClick={() => selectGame(index)}
                  className="group flex shrink-0 snap-start focus-visible:outline-none"
                >
                  <span
                    className={`flex size-[4.875rem] items-center justify-center rounded-md bg-background p-[18%] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 sm:size-[6.25rem] sm:rounded-md sm:p-[20%] ${
                      isSelected
                        ? "border-(length:--border-width-strong) border-ring"
                        : "border-(length:--border-width-normal) border-border group-hover:bg-accent"
                    }`}
                  >
                    <GamePictogram svg={game.pictogramSvg} />
                  </span>
                </button>
              );
            })}
          </div>
          {scrollbar.size < 1 && (
            <div
              aria-hidden="true"
              className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-muted sm:mx-0"
            >
              <div
                className="h-full rounded-full bg-muted-foreground/50"
                style={{
                  width: `${scrollbar.size * 100}%`,
                  transform: `translateX(${(scrollbar.offset / scrollbar.size) * 100}%)`,
                }}
              />
            </div>
          )}
        </div>
      </nav>
    </section>
  );
}
