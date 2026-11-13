import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type RefObject,
  type UIEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ZukanProblemSquare } from "@/app/game-home/GameHomeScreen/ZukanProblemSheet/ZukanProblemSquare";
import type { ZukanChangeStage } from "@/app/game-home/GameHomeScreen/zukan-change-reveal";
import { findZukanPieceShape } from "@/features/zukan/ui/zukan-piece-shape";
import {
  getNarrowZukanSquareSizePx,
  getWideZukanSquareSizePx,
} from "@/features/zukan/ui/zukan-sheet-layout";
import type { ZukanProblem } from "@/features/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/features/zukan/zukan-last-viewed";
import {
  clearOpeningZukanSheetRow,
  peekOpeningZukanSheetRow,
} from "@/features/zukan/zukan-sheet-opening";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";
import { isScreenTransitionRunning } from "@/lib/screen-transition";

type ZukanProblemSheetProps = {
  difficulty: DifficultyLevel;
  /** そのレベルの全問。マスはこの順に置き、絞り込んでも置き直さない。 */
  problemsInNumberOrder: readonly ZukanProblem[];
  /** 台紙に並べて見せる順の全問。絞り込んでいなければ番号の順、絞り込んでいれば当たった問題が前。 */
  arrangedProblems: readonly ZukanProblem[];
  /** 絞り込んでいるとき、前に並べた当たった問題の数。絞り込んでいなければ `null`。 */
  matchedCount: number | null;
  numberDigitCount: number;
  selectedProblemId: ProblemId | null;
  /** 見せる変化が無ければ `undefined`。 */
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined;
  /** 見せる変化が無ければ `undefined`。 */
  changeStages: ReadonlyMap<ProblemId, ZukanChangeStage> | undefined;
  /** 台紙のスクロール領域。マスは `data-index` に番号の順の位置を持つ。 */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** スクロール領域の下端に重なって覆っている高さ（px）。覆われたところのマスも、その上へスクロールして見られるようにする。 */
  coveredBottomHeight: number;
  onWidthChange: (widthPx: number) => void;
  /** 選んでいないマスを押したときと、矢印キーなどで動いたとき。 */
  onSelect: (problem: ZukanProblem) => void;
  /** 選んでいるマスをもう一度押したとき。 */
  onDeselect: () => void;
};

type SquareRow = { start: number; length: number };

/** 当たった問題と当たらなかった問題は、それぞれ行の頭から並べる。 */
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

const NO_PROBLEMS: readonly ZukanProblem[] = [];

function listPositions(
  problems: readonly ZukanProblem[],
): ReadonlyMap<ProblemId, number> {
  return new Map(problems.map(({ problemId }, index) => [problemId, index]));
}

/**
 * 難易度の名前と解いた数は、台紙を切り替えるレベルのカードが示す。
 * 絞り込んでいるときは、当たった問題を前に、当たらなかった問題を薄くして区切りの線の後ろに、それぞれ番号の順で並べる。当たった問題が無ければ、その旨を前に示す。
 */
function ZukanProblemSheetContent({
  difficulty,
  problemsInNumberOrder,
  arrangedProblems,
  matchedCount,
  numberDigitCount,
  selectedProblemId,
  changes,
  changeStages,
  scrollerRef,
  coveredBottomHeight,
  onWidthChange,
  onSelect,
  onDeselect,
}: ZukanProblemSheetProps) {
  const [lastSelectedProblemId, setLastSelectedProblemId] =
    useState<ProblemId | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  // 画面の行き来の動きの中で開いたときは、マスの描画が動き出しを止めないよう、マスを描かずに開き、後から描く。
  const drawsSquares = useDeferredValue(true, !isScreenTransitionRunning());
  const gridRef = useRef<HTMLDivElement>(null);
  const openingRowRef = useRef(peekOpeningZukanSheetRow());
  useEffect(() => clearOpeningZukanSheetRow(), []);
  const reportWidth = useEffectEvent(onWidthChange);
  const shownScrollTopRef = useRef(0);
  const previousCoveredBottomHeightRef = useRef(coveredBottomHeight);
  const indices = useMemo(
    () => listPositions(problemsInNumberOrder),
    [problemsInNumberOrder],
  );
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

  // ピースの形は並べた位置で決まり、列の数は画面幅で変わるので、台紙の幅を見張って数え直す。
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (grid === null) {
      return;
    }
    function updateColumnCount() {
      setColumnCount(countGridColumns(grid));
      if (grid !== null) {
        reportWidth(grid.clientWidth);
      }
    }
    updateColumnCount();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // パズル選択の額の中の台紙は縦に送れる。額から入ったときは、額で見ていた行から台紙を見せて開く。
  // マスを描くまで台紙に高さが無いので、描いてから送る。問題を選んで開いたときは、選んだマスへ寄せるので送らない。
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    const openingRow = openingRowRef.current;
    if (
      !drawsSquares ||
      openingRow <= 0 ||
      scroller === null ||
      grid === null
    ) {
      return;
    }
    openingRowRef.current = 0;
    // 行の高さから求めると端数がずれるので、その行の最初のマスの位置から送る。
    const row = Math.floor(openingRow);
    const firstSquare = findSquare(grid, row * countGridColumns(grid));
    if (selectedIndex === null && firstSquare !== null) {
      const square = firstSquare.getBoundingClientRect();
      scroller.scrollTop +=
        square.top -
        grid.getBoundingClientRect().top +
        (openingRow - row) * square.height;
    }
  }, [drawsSquares, selectedIndex, scrollerRef]);

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

  // 条件を変えても選んだマスへは寄せ直さない。
  // 下端を覆う高さは描いたあとに分かり、マスは後から描くことがあるので、選んだマスだけでなく、覆う高さが変わったときとマスを描いたときも寄せ直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 覆う高さはスクロールの余白として描かれ、寄せる先を変える。マスを描くまでは寄せる先が無い。
  useLayoutEffect(() => {
    if (selectedIndex === null) {
      return;
    }
    findSquare(gridRef.current, selectedIndex)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedIndex, coveredBottomHeight, drawsSquares]);

  function selectSquare(problem: ZukanProblem) {
    setLastSelectedProblemId(problem.problemId);
    onSelect(problem);
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    shownScrollTopRef.current = event.currentTarget.scrollTop;
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    const problem = index === null ? undefined : problemsInNumberOrder[index];
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
    const problem = index === null ? undefined : problemsInNumberOrder[index];
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

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      style={
        { "--covered-bottom": `${coveredBottomHeight}px` } as CSSProperties
      }
      // 押すときに大きく浮くマスが、台紙の端のマスでもスクロール領域で切れないよう、領域を盤の余白とページの余白へ広げ、内側に浮いたマスが収まる余白を取る。
      className="-mx-6 min-h-0 flex-1 scroll-pb-(--covered-bottom) overflow-y-auto overscroll-contain px-6 pt-4 pb-2 sm:-mx-7 sm:px-7 sm:pb-3 lg:pt-3 [scrollbar-width:none] lg:[scrollbar-width:thin]"
    >
      {/* スクロールした行が台紙の上の数の真下で途切れて見えないよう、上端の余白の中で盤の色を重ねて薄れさせる。選んだマスはこの余白より内側へ寄せる。 */}
      {/* 薄れは `mask-image` で作らない。iOS の Safari は mask をかけた要素の中身を低い解像度で描き、ピースの輪郭がぼやけるため。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky -top-4 z-10 -mt-4 mb-1 h-3 bg-linear-to-b from-background"
      />
      <div
        ref={gridRef}
        data-screen-shared="sheet"
        role="group"
        aria-label={`${getDifficultyLabel(difficulty)}の問題`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={
          {
            "--wide-square-size": `${getWideZukanSquareSizePx(problemsInNumberOrder.length)}px`,
            "--narrow-square-size": `${getNarrowZukanSquareSizePx(problemsInNumberOrder.length)}px`,
          } as CSSProperties
        }
        // 盤の幅をマスで埋め切るよう、マスは決めた大きさ以上で、列を等分して並べる。
        // 条件を変えるたびに多くのマスを置き直さないよう、マスは番号の順に置いたまま、当たらなかったマスを CSS の `order` で区切りの後ろへ並べて見せる。
        className="isolate grid grid-cols-[repeat(auto-fill,minmax(var(--narrow-square-size),1fr))] lg:grid-cols-[repeat(auto-fill,minmax(var(--wide-square-size),1fr))] [&>[data-filtered-out]]:order-2"
      >
        {matchedCount === 0 && (
          <p className="col-span-full text-supporting text-muted-foreground">
            条件に当たる問題はありません
          </p>
        )}
        {(drawsSquares ? problemsInNumberOrder : NO_PROBLEMS).map(
          (problem, index) => (
            <ZukanProblemSquare
              key={problem.problemId}
              problem={problem}
              index={index}
              pieceShape={findZukanPieceShape(
                positions.get(problem.problemId) ?? index,
                matchedCount ?? arrangedProblems.length,
                arrangedProblems.length,
                columnCount,
              )}
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
          ),
        )}
        {hasFilteredOut && (
          <div
            aria-hidden="true"
            data-filter-boundary=""
            className="order-1 col-span-full my-1.5 border-t-(length:--border-width-normal) border-border"
          />
        )}
      </div>
      {/* 覆われたところの余白は、領域の余白ではなく末尾の要素で取る。画面が低く、覆う高さが領域より高いときも、領域が縮めずにページをはみ出さないようにする。 */}
      <div aria-hidden="true" className="h-(--covered-bottom)" />
      {/* 盤の下端で途切れた行が、まだ続くと分かるよう、下端でも盤の色を重ねて薄れさせる。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky -bottom-2 z-10 -mt-3 h-3 bg-linear-to-t from-background sm:-bottom-3"
      />
    </div>
  );
}

export const ZukanProblemSheet = memo(ZukanProblemSheetContent);

export const _private = {
  findNextSquareIndex,
};
