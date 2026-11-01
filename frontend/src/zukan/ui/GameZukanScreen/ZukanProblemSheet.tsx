import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type RefObject,
  type UIEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { getDifficultyLabel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";
import { ZukanProblemSquare } from "@/zukan/ui/GameZukanScreen/ZukanProblemSheet/ZukanProblemSquare";
import type { ZukanChangeStage } from "@/zukan/ui/GameZukanScreen/zukan-change-reveal";
import type {
  ZukanDifficultySection,
  ZukanProblem,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

type ZukanProblemSheetProps = {
  section: ZukanDifficultySection;
  numberDigitCount: number;
  /** この台紙の中で選んでいる問題の位置。選んでいなければ `null`。 */
  selectedIndex: number | null;
  /** 前回図鑑を見たときから変化した問題と、その変化。見せる変化が無ければ `undefined`。 */
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined;
  /** 変化した問題ごとの、変化を今どこまで見せたか。見せる変化が無ければ `undefined`。 */
  changeStages: ReadonlyMap<ProblemId, ZukanChangeStage> | undefined;
  /** 台紙のスクロール領域。変化を見せるときに、変化したマスが見えるようスクロールするのに使う。 */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** スクロール領域の下端に重なって覆っている高さ（px）。覆われたところのマスも、その上へスクロールして見られるようにする。 */
  coveredBottomHeight: number;
  /** 選んでいないマスを押したときと、矢印キーなどで動いたとき。 */
  onSelect: (problem: ZukanProblem) => void;
  /** 選んでいるマスをもう一度押したとき。 */
  onDeselect: () => void;
};

/**
 * キー操作で移る先のマスの位置。台紙の端より先へは動かず、台紙の操作でないキーには `null` を返す。
 * Home と End は台紙の最初と最後のマスへ移る。
 */
function findNextSquareIndex(
  key: string,
  index: number,
  squareCount: number,
  columnCount: number,
): number | null {
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return squareCount - 1;
  }
  const arrowKeyOffsets: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: columnCount,
    ArrowUp: -columnCount,
  };
  const offset = arrowKeyOffsets[key];
  if (offset === undefined) {
    return null;
  }
  const nextIndex = index + offset;
  return nextIndex >= 0 && nextIndex < squareCount ? nextIndex : index;
}

/** 列の数は画面幅に合わせて決まるので、描かれた台紙の列から数える。 */
function countGridColumns(grid: HTMLElement | null): number {
  if (grid === null) {
    return 1;
  }
  const columns = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter((column) => column !== "");
  return Math.max(columns.length, 1);
}

function findSquareIndex(target: EventTarget): number | null {
  const square =
    target instanceof Element
      ? target.closest<HTMLElement>("[data-index]")
      : null;
  return square ? Number(square.dataset.index) : null;
}

/**
 * 1つの難易度の全問を、番号の順にマス目で並べた台紙。難易度の名前と解いた数は、台紙を切り替えるタブが示す。
 * 台紙は与えられた高さの中で自分だけスクロールし、選んだマスを、下端を覆うものに隠れない見える範囲へ寄せる。
 * マスは台紙ごとに1つだけ Tab で止まり、台紙の中は矢印キーで動く。動いた先のマスを選ぶ。選んでいるマスをもう一度押すと選択を解く。
 */
function ZukanProblemSheetContent({
  section,
  numberDigitCount,
  selectedIndex,
  changes,
  changeStages,
  scrollerRef,
  coveredBottomHeight,
  onSelect,
  onDeselect,
}: ZukanProblemSheetProps) {
  const [tabStopIndex, setTabStopIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const shownScrollTopRef = useRef(0);
  const previousCoveredBottomHeightRef = useRef(coveredBottomHeight);

  // 覆うものが退いて末尾の余白が減ると、末尾まで送っていた台紙はスクロール位置が詰められて跳ぶので、元の位置から滑らせて下ろす。
  useLayoutEffect(() => {
    const isUncovered =
      coveredBottomHeight < previousCoveredBottomHeightRef.current;
    previousCoveredBottomHeightRef.current = coveredBottomHeight;
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!isUncovered || scroller === null || grid === null) {
      return;
    }
    const clampedBy = shownScrollTopRef.current - scroller.scrollTop;
    if (clampedBy > 0 && !prefersReducedMotion()) {
      grid.animate(
        [{ transform: `translateY(${-clampedBy}px)` }, { transform: "none" }],
        {
          duration: MOTION_DURATION_MS.normal,
          easing: MOTION_EASING.standard,
        },
      );
    }
  }, [coveredBottomHeight, scrollerRef]);

  // 下端を覆う高さは描いたあとに分かるので、選んだマスだけでなく覆う高さが変わったときも寄せ直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 覆う高さはスクロールの余白として描かれ、寄せる先を変える。
  useLayoutEffect(() => {
    if (selectedIndex === null) {
      return;
    }
    gridRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedIndex, coveredBottomHeight]);

  function selectSquare(index: number) {
    const problem = section.problems[index];
    if (problem) {
      setTabStopIndex(index);
      onSelect(problem);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    shownScrollTopRef.current = event.currentTarget.scrollTop;
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    if (index === null) {
      return;
    }
    if (index === selectedIndex) {
      onDeselect();
    } else {
      selectSquare(index);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    if (index === null) {
      return;
    }
    const nextIndex = findNextSquareIndex(
      event.key,
      index,
      section.problems.length,
      countGridColumns(gridRef.current),
    );
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    selectSquare(nextIndex);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-index="${nextIndex}"]`)
      ?.focus({ preventScroll: true });
  }

  // 押すときに大きく浮くマスと広がる輪が、台紙の端のマスでもスクロール領域で切れないよう、領域をページの余白へ広げ、内側に輪が収まる余白を取る。
  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      style={
        { "--covered-bottom": `${coveredBottomHeight}px` } as CSSProperties
      }
      className="-mx-4 min-h-0 flex-1 scroll-pb-(--covered-bottom) overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(--spacing(4)+var(--covered-bottom))]"
    >
      <div
        ref={gridRef}
        role="group"
        aria-label={`${getDifficultyLabel(section.difficulty)}の問題`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="isolate grid grid-cols-[repeat(auto-fill,--spacing(3.5))] gap-0.5 sm:grid-cols-[repeat(auto-fill,--spacing(4))]"
      >
        {section.problems.map((problem, index) => (
          <ZukanProblemSquare
            key={problem.problemId}
            problem={problem}
            index={index}
            numberDigitCount={numberDigitCount}
            isTabStop={index === tabStopIndex}
            isSelected={index === selectedIndex}
            change={changes?.get(problem.problemId) ?? null}
            changeStage={changeStages?.get(problem.problemId) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

export const ZukanProblemSheet = memo(ZukanProblemSheetContent);

export const _private = { findNextSquareIndex };
