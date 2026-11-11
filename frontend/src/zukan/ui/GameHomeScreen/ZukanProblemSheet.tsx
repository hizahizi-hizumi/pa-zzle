import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { ZukanProblemSquare } from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet/ZukanProblemSquare";
import {
  snapZukanScrollTopToRows,
  type ZukanChangeStage,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import { findZukanPieceShape } from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import {
  findZukanPieceLayout,
  type ZukanPieceLayout,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-size";
import {
  ZUKAN_PIECE_RECESS_ID,
  ZUKAN_PIECE_SHEEN_ID,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblem } from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

type ZukanProblemSheetProps = {
  /** 台紙の頭に置く、その台紙の問題の数え方。マスと一緒にスクロールさせない。 */
  header: ReactNode;
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
  /** ジグソーの下端に重ねて見せているものの高さ（px）。その分だけ余計にスクロールできるようにし、選んだピースを隠れない所へ寄せる。重ねていなければ 0。 */
  coveredBottomHeight: number;
  /** 前回図鑑を見たときから変化した問題と、その変化。見せる変化が無ければ `undefined`。 */
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined;
  /** 変化した問題ごとの、変化を今どこまで見せたか。見せる変化が無ければ `undefined`。 */
  changeStages: ReadonlyMap<ProblemId, ZukanChangeStage> | undefined;
  /** 台紙のスクロール領域。マスは `data-index` に番号の順の位置を持つ。変化を見せるときに、変化したマスが見えるようスクロールするのに使う。 */
  scrollerRef: RefObject<HTMLDivElement | null>;
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

/** 中身がスクロールすると見なす、はみ出しの下限（px）。端数の丸めで 1px はみ出すだけの中身を、スクロールすると見なさない。 */
const SCROLLABLE_SLACK = 1;

function listPositions(
  problems: readonly ZukanProblem[],
): ReadonlyMap<ProblemId, number> {
  return new Map(problems.map(({ problemId }, index) => [problemId, index]));
}

/**
 * 選んだピースへ寄せた台紙を、行の上端が見える範囲の上端に揃う所へ寄せ直す。台紙の上端の行が、頭の帯の下で半端に切れて見えないようにする。
 * 寄せ直す幅は行の間隔の半分までなので、ピースの周りに取った余白の中に収まり、選んだピースは隠れない。
 */
function alignSheetToRows(scroller: HTMLElement, piece: HTMLElement) {
  if (scroller.scrollTop === 0) {
    return;
  }
  const pieceBox = piece.getBoundingClientRect();
  scroller.scrollTop = snapZukanScrollTopToRows(
    scroller.scrollTop,
    {
      alignedScrollTop:
        scroller.scrollTop +
        pieceBox.top -
        scroller.getBoundingClientRect().top,
      pitch: pieceBox.height,
    },
    scroller.scrollHeight - scroller.clientHeight,
  );
}

/**
 * 1つの難易度の全問をピースにしたジグソー。ゲーム固有の地の上に置いた台として描き、空きは台の凹み、解いた問題は台に置いたピースとして見せる。難易度の名前と解いた数は、台紙を切り替えるレベルのカードが示す。
 * ピースは幅いっぱいに組み、収まらない分は台紙の中で縦にスクロールさせる。
 * 絞り込んでいるときは、当たった問題を前に、当たらなかった問題を薄くして区切りの線の後ろに、それぞれ番号の順で並べる。当たった問題が無ければ、その旨を前に示す。
 * 条件を変えるたびに多くのマスを置き直さないよう、マスは番号の順に置いたまま、当たらなかったマスを CSS の `order` で区切りの後ろへ並べて見せる。
 * 台紙は与えられた高さの中で自分だけスクロールし、選んだマスを見える範囲へ寄せる。条件を変えても選んだマスへは寄せ直さない。
 * マスは台紙ごとに1つだけ Tab で止まり、台紙の中は見えている並びに沿って矢印キーで動く。動いた先のマスを選ぶ。選んでいるマスをもう一度押すと選択を解く。
 * Tab で止まるマスは問題で持ち、選んでいるマスがあればそのマス、無ければ最後に選んだマス、それも台紙に無ければ並びの最初のマスにする。
 */
function ZukanProblemSheetContent({
  header,
  difficulty,
  problems,
  arrangedProblems,
  matchedCount,
  numberDigitCount,
  selectedProblemId,
  coveredBottomHeight,
  changes,
  changeStages,
  scrollerRef,
  onSelect,
  onDeselect,
}: ZukanProblemSheetProps) {
  const [lastSelectedProblemId, setLastSelectedProblemId] =
    useState<ProblemId | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [layout, setLayout] = useState<ZukanPieceLayout | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    const area = areaRef.current;
    const scroller = scrollerRef.current;
    if (area === null || scroller === null) {
      return;
    }
    function updateLayout() {
      if (area === null || scroller === null) {
        return;
      }
      const { paddingLeft, paddingRight } = getComputedStyle(scroller);
      const next = findZukanPieceLayout(
        problems.length,
        area.getBoundingClientRect().width -
          parseFloat(paddingLeft) -
          parseFloat(paddingRight),
      );
      setLayout((current) =>
        current?.pieceSize === next?.pieceSize &&
        current?.columnCount === next?.columnCount
          ? current
          : next,
      );
    }
    updateLayout();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateLayout);
    observer.observe(area);
    return () => observer.disconnect();
  }, [scrollerRef, problems.length]);

  // ピースの形は並べた位置で決まり、列の数は画面幅で変わるので、台紙の幅を見張って数え直す。
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (grid === null) {
      return;
    }
    function updateColumnCount() {
      setColumnCount(countGridColumns(grid));
    }
    updateColumnCount();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // 下端の薄れは、実際にスクロールできるときだけ出す。
  const [canScroll, setCanScroll] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 下端に足す余白の高さが変わると、スクロール領域の大きさは同じまま中身の高さが変わるため。
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (scroller === null || grid === null) {
      return;
    }
    function updateCanScroll() {
      if (scroller !== null) {
        setCanScroll(
          scroller.scrollHeight - scroller.clientHeight > SCROLLABLE_SLACK,
        );
      }
    }
    updateCanScroll();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateCanScroll);
    observer.observe(scroller);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [scrollerRef, coveredBottomHeight]);

  // 下端に重ねたものに選んだピースが隠れないよう、その高さを除いた範囲へ寄せる。高さと、ピースの並びが決まったら寄せ直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: ピースの並びが変わると、選んだピースの位置が変わるため。
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) {
      return;
    }
    scroller.style.scrollPaddingBottom = `${coveredBottomHeight}px`;
    const piece =
      selectedIndex === null
        ? null
        : findSquare(gridRef.current, selectedIndex);
    if (piece === null) {
      return;
    }
    piece.scrollIntoView({ block: "nearest", inline: "nearest" });
    alignSheetToRows(scroller, piece);
  }, [scrollerRef, selectedIndex, coveredBottomHeight, layout]);

  function selectSquare(problem: ZukanProblem) {
    setLastSelectedProblemId(problem.problemId);
    onSelect(problem);
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

  const shownColumnCount = layout?.columnCount ?? columnCount;

  const hasFilteredOut =
    matchedCount !== null && matchedCount < arrangedProblems.length;

  // 押すときに大きく浮くマスが、台紙の端のマスでもスクロール領域で切れないよう、内側に浮いたマスが収まる余白を取る。
  // スクロールした行が台紙の頭の数の真下で途切れて見えないよう、上端の余白の中で台紙の面の色を重ねて薄れさせる。選んだマスはこの余白より内側へ寄せる。
  // 薄れは `mask-image` で作らない。iOS の Safari は mask をかけた要素の中身を低い解像度で描き、ピースの輪郭がぼやけるため。
  return (
    <div ref={areaRef} className="isolate flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-(--zukan-tray) shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-6px_rgb(0_0_0/0.22)] [--zukan-groove:color-mix(in_oklab,var(--browser-surface,var(--card))_64%,var(--foreground))] [--zukan-recess:color-mix(in_oklab,var(--browser-surface,var(--card))_80%,var(--foreground))] [--zukan-tray:color-mix(in_oklab,var(--browser-surface,var(--card))_94%,var(--foreground))]">
        <svg aria-hidden="true" className="absolute size-0">
          <defs>
            <linearGradient
              id={ZUKAN_PIECE_SHEEN_ID}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient
              id={ZUKAN_PIECE_RECESS_ID}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" stopColor="#000" stopOpacity="0.12" />
              <stop offset="0.3" stopColor="#000" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="px-4 pt-3">{header}</div>
        <div
          ref={scrollerRef}
          style={
            {
              ...(layout !== null && {
                "--zukan-piece-size": `${layout.pieceSize}px`,
                "--zukan-columns": `repeat(${layout.columnCount}, ${layout.pieceSize}px)`,
              }),
            } as CSSProperties
          }
          className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-4"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none sticky -top-4 z-10 -mt-4 mb-1 h-3 bg-linear-to-b from-(--zukan-tray)"
          />
          {/* 押していく演出の層は、この囲みにマスと重ねて置く。マスと演出の層の重ね順をこの中に閉じ、スクロール領域の端の薄れより手前に出さない。 */}
          <div className="relative isolate mx-auto w-fit">
            <div
              ref={gridRef}
              role="group"
              aria-label={`${getDifficultyLabel(difficulty)}の問題`}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              className="grid grid-cols-(--zukan-columns,repeat(auto-fill,--spacing(16))) justify-center [&>[data-filtered-out]]:order-2"
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
                  pieceShape={findZukanPieceShape(
                    positions.get(problem.problemId) ?? index,
                    matchedCount ?? arrangedProblems.length,
                    arrangedProblems.length,
                    shownColumnCount,
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
              ))}
              {hasFilteredOut && (
                <div
                  aria-hidden="true"
                  data-filter-boundary=""
                  className="order-1 col-span-full my-1.5 border-t-(length:--border-width-normal) border-border"
                />
              )}
            </div>
          </div>
          {coveredBottomHeight > 0 && (
            <div aria-hidden="true" style={{ height: coveredBottomHeight }} />
          )}
          {canScroll && (
            <div
              aria-hidden="true"
              data-zukan-bottom-fade=""
              // 薄れが場所を取ると、収まっていた中身がスクロールするようになり、薄れの出し入れが繰り返される。上下の余白で高さを打ち消す。
              className="pointer-events-none sticky -bottom-4 z-10 -mt-1 -mb-4 h-5 bg-linear-to-t from-(--zukan-tray)"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const ZukanProblemSheet = memo(ZukanProblemSheetContent);

export const _private = { findNextSquareIndex };
