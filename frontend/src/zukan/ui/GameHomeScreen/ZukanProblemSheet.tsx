import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type RefObject,
  type UIEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";
import { ZukanProblemSquare } from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet/ZukanProblemSquare";
import type { ZukanChangeStage } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanProblem } from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

type ZukanProblemSheetProps = {
  difficulty: DifficultyLevel;
  /** そのレベルの全問。番号の順。マスはこの順に置き、絞り込んでも置き直さない。 */
  problems: readonly ZukanProblem[];
  /** 台紙に並べて見せる順の全問。絞り込んでいなければ番号の順、絞り込んでいれば当たった問題が前。 */
  arrangedProblems: readonly ZukanProblem[];
  /** 絞り込んでいるとき、前に並べた当たった問題の数。絞り込んでいなければ `null`。 */
  matchedCount: number | null;
  numberDigitCount: number;
  /** 選んでいる問題。選んでいなければ `null`。 */
  selectedProblemId: ProblemId | null;
  /** 前回図鑑を見たときから変化した問題と、その変化。見せる変化が無ければ `undefined`。 */
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined;
  /** 変化した問題ごとの、変化を今どこまで見せたか。見せる変化が無ければ `undefined`。 */
  changeStages: ReadonlyMap<ProblemId, ZukanChangeStage> | undefined;
  /** 台紙のスクロール領域。マスは `data-index` に番号の順の位置を持つ。変化を見せるときに、変化したマスが見えるようスクロールするのに使う。 */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** スクロール領域の下端に重なって覆っている高さ（px）。覆われたところのマスも、その上へスクロールして見られるようにする。 */
  coveredBottomHeight: number;
  /** 選んでいないマスを押したときと、矢印キーなどで動いたとき。 */
  onSelect: (problem: ZukanProblem) => void;
  /** 選んでいるマスをもう一度押したとき。 */
  onDeselect: () => void;
};

type SquareRow = { start: number; length: number };

/** 台紙の行。当たった問題と当たらなかった問題は、それぞれ行の頭から並べる。 */
function listSquareRows(
  squareCount: number,
  columnCount: number,
  matchedCount: number,
): SquareRow[] {
  return [
    { start: 0, end: matchedCount },
    { start: matchedCount, end: squareCount },
  ].flatMap(({ start, end }) =>
    Array.from({ length: Math.ceil((end - start) / columnCount) }, (_, row) => {
      const rowStart = start + row * columnCount;
      return { start: rowStart, length: Math.min(columnCount, end - rowStart) };
    }),
  );
}

/**
 * キー操作で移る先のマスの位置。台紙の端より先へは動かず、台紙の操作でないキーには `null` を返す。
 * 左右は並びの前後へ、上下は見えている行の同じ列へ移り、その列が無い短い行では行の最後のマスへ移る。
 * Home と End は台紙の最初と最後のマスへ移る。
 */
function findNextSquareIndex(
  key: string,
  index: number,
  squareCount: number,
  columnCount: number,
  matchedCount: number,
): number | null {
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return squareCount - 1;
    case "ArrowRight":
      return Math.min(index + 1, squareCount - 1);
    case "ArrowLeft":
      return Math.max(index - 1, 0);
    case "ArrowDown":
    case "ArrowUp": {
      const rows = listSquareRows(squareCount, columnCount, matchedCount);
      const rowIndex = rows.findIndex(
        ({ start, length }) => start <= index && index < start + length,
      );
      const row = rows[rowIndex];
      const nextRow = rows[rowIndex + (key === "ArrowDown" ? 1 : -1)];
      if (row === undefined || nextRow === undefined) {
        return index;
      }
      return nextRow.start + Math.min(index - row.start, nextRow.length - 1);
    }
    default:
      return null;
  }
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

function findSquare(
  grid: HTMLElement | null,
  index: number,
): HTMLElement | null {
  return grid?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null;
}

function listPositions(
  problems: readonly ZukanProblem[],
): ReadonlyMap<ProblemId, number> {
  return new Map(problems.map(({ problemId }, index) => [problemId, index]));
}

/**
 * 1つの難易度の全問をマス目で並べた台紙。難易度の名前と解いた数は、台紙を切り替えるレベルのカードが示す。
 * 絞り込んでいるときは、当たった問題を前に、当たらなかった問題を薄くして区切りの線の後ろに、それぞれ番号の順で並べる。当たった問題が無ければ、その旨を前に示す。
 * 条件を変えるたびに多くのマスを置き直さないよう、マスは番号の順に置いたまま、当たらなかったマスを CSS の `order` で区切りの後ろへ並べて見せる。
 * 台紙は与えられた高さの中で自分だけスクロールし、選んだマスを、下端を覆うものに隠れない見える範囲へ寄せる。条件を変えても選んだマスへは寄せ直さない。
 * マスは台紙ごとに1つだけ Tab で止まり、台紙の中は見えている並びに沿って矢印キーで動く。動いた先のマスを選ぶ。選んでいるマスをもう一度押すと選択を解く。
 * Tab で止まるマスは問題で持ち、選んでいるマスがあればそのマス、無ければ最後に選んだマス、それも台紙に無ければ並びの最初のマスにする。
 */
function ZukanProblemSheetContent({
  difficulty,
  problems,
  arrangedProblems,
  matchedCount,
  numberDigitCount,
  selectedProblemId,
  changes,
  changeStages,
  scrollerRef,
  coveredBottomHeight,
  onSelect,
  onDeselect,
}: ZukanProblemSheetProps) {
  const [lastSelectedProblemId, setLastSelectedProblemId] =
    useState<ProblemId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const shownScrollTopRef = useRef(0);
  const previousCoveredBottomHeightRef = useRef(coveredBottomHeight);
  const indices = useMemo(() => listPositions(problems), [problems]);
  const positions = useMemo(
    () => listPositions(arrangedProblems),
    [arrangedProblems],
  );
  const selectedIndex =
    selectedProblemId === null
      ? null
      : (indices.get(selectedProblemId) ?? null);
  const tabStopProblemId =
    selectedIndex !== null
      ? selectedProblemId
      : lastSelectedProblemId !== null && indices.has(lastSelectedProblemId)
        ? lastSelectedProblemId
        : (arrangedProblems[0]?.problemId ?? null);

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
    findSquare(gridRef.current, selectedIndex)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedIndex, coveredBottomHeight]);

  function selectSquare(problem: ZukanProblem) {
    setLastSelectedProblemId(problem.problemId);
    onSelect(problem);
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    shownScrollTopRef.current = event.currentTarget.scrollTop;
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    const problem = index === null ? undefined : problems[index];
    if (problem === undefined) {
      return;
    }
    if (problem.problemId === selectedProblemId) {
      onDeselect();
    } else {
      selectSquare(problem);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    const problem = index === null ? undefined : problems[index];
    const position =
      problem === undefined ? undefined : positions.get(problem.problemId);
    if (position === undefined) {
      return;
    }
    const nextPosition = findNextSquareIndex(
      event.key,
      position,
      arrangedProblems.length,
      countGridColumns(gridRef.current),
      matchedCount ?? arrangedProblems.length,
    );
    const nextProblem =
      nextPosition === null ? undefined : arrangedProblems[nextPosition];
    const nextIndex =
      nextProblem === undefined
        ? undefined
        : indices.get(nextProblem.problemId);
    if (nextProblem === undefined || nextIndex === undefined) {
      return;
    }
    event.preventDefault();
    selectSquare(nextProblem);
    findSquare(gridRef.current, nextIndex)?.focus({ preventScroll: true });
  }

  const hasFilteredOut =
    matchedCount !== null && matchedCount < arrangedProblems.length;

  // 押すときに大きく浮くマスと広がる輪が、台紙の端のマスでもスクロール領域で切れないよう、領域をページの余白へ広げ、内側に輪が収まる余白を取る。
  // 覆われたところの余白は、領域の余白ではなく末尾の要素で取る。画面が低く、覆う高さが領域より高いときも、領域が縮めずにページをはみ出さないようにする。
  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      style={
        { "--covered-bottom": `${coveredBottomHeight}px` } as CSSProperties
      }
      className="-mx-4 min-h-0 flex-1 scroll-pb-(--covered-bottom) overflow-y-auto overscroll-contain px-4 pt-4 pb-4"
    >
      <div
        ref={gridRef}
        role="group"
        aria-label={`${getDifficultyLabel(difficulty)}の問題`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="isolate grid grid-cols-[repeat(auto-fill,--spacing(3.5))] gap-0.5 sm:grid-cols-[repeat(auto-fill,--spacing(4))] [&>[data-filtered-out]]:order-2"
      >
        {matchedCount === 0 && (
          <p className="col-span-full text-supporting text-muted-foreground">
            条件に当たる問題はありません
          </p>
        )}
        {problems.map((problem, index) => (
          <ZukanProblemSquare
            key={problem.problemId}
            problem={problem}
            index={index}
            numberDigitCount={numberDigitCount}
            isTabStop={problem.problemId === tabStopProblemId}
            isSelected={index === selectedIndex}
            isFilteredOut={
              matchedCount !== null &&
              (positions.get(problem.problemId) ?? 0) >= matchedCount
            }
            change={changes?.get(problem.problemId) ?? null}
            changeStage={changeStages?.get(problem.problemId) ?? null}
          />
        ))}
        {hasFilteredOut && (
          <div
            aria-hidden="true"
            data-filter-boundary=""
            className="order-1 col-span-full my-1.5 border-t-(length:--border-width-normal) border-border"
          />
        )}
      </div>
      <div aria-hidden="true" className="h-(--covered-bottom)" />
    </div>
  );
}

export const ZukanProblemSheet = memo(ZukanProblemSheetContent);

export const _private = { findNextSquareIndex };
