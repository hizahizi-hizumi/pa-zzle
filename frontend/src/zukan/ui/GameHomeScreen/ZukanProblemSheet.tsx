import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { ZukanProblemSquare } from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet/ZukanProblemSquare";
import type { ZukanChangeStage } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import { findZukanPieceShape } from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import {
  fitZukanSheet,
  type ZukanSheetFit,
} from "@/zukan/ui/GameHomeScreen/zukan-sheet-fit";
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
  /** 台紙の領域。マスは `data-index` に番号の順の位置を持つ。変化を見せるときに、変化したマスを探すのに使う。 */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** マスを押す・なぞる操作を受けないか。変化を見せている間は、飛ばすタップでマスを選ばないようにする。 */
  selectionDisabled: boolean;
  /** マスを押したとき・なぞって通ったときと、矢印キーなどで動いたとき。 */
  onSelect: (problem: ZukanProblem) => void;
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

/** 絞り込みで当たった問題と当たらなかった問題を分ける区切りの高さ（px）。区切りの上下の余白と線を合わせたもの。 */
const FILTER_BOUNDARY_HEIGHT = 13;

/** 画面の点にあるマスの、番号の順の位置。マスの外なら `null`。指を押さえたまま動かしている間は、イベントの的ではなく指の下のマスを引く。 */
function findSquareIndexAt(x: number, y: number): number | null {
  const element = document.elementFromPoint?.(x, y);
  return element ? findSquareIndex(element) : null;
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
 * 1つの難易度の全問をジグソーのピースで並べた台紙。難易度の名前と解いた数は、台紙を切り替えるレベルの帯が示す。
 * 全問を送らずに一度に見渡せるよう、与えられた場所の幅と高さに全部が収まる最も大きいピースで並べる。場所の大きさが変わったら並べ直す。
 * 絞り込んでいるときは、当たった問題を前に、当たらなかった問題を薄くして区切りの線の後ろに、それぞれ番号の順で並べる。当たった問題が無ければ、その旨を前に示す。
 * 条件を変えるたびに多くのマスを置き直さないよう、マスは番号の順に置いたまま、当たらなかったマスを CSS の `order` で区切りの後ろへ並べて見せる。
 * マスは、押すか、押さえたままなぞると選ぶ。ピースが指より小さくても狙った1問へ寄せられるよう、なぞっている間は指の下のマスを選び続ける。
 * マスは台紙ごとに1つだけ Tab で止まり、台紙の中は見えている並びに沿って矢印キーで動く。動いた先のマスを選ぶ。
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
  selectionDisabled,
  onSelect,
}: ZukanProblemSheetProps) {
  const [lastSelectedProblemId, setLastSelectedProblemId] =
    useState<ProblemId | null>(null);
  const [fit, setFit] = useState<ZukanSheetFit | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrubbedIndexRef = useRef<number | null>(null);
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
  const hasFilteredOut =
    matchedCount !== null && matchedCount < arrangedProblems.length;
  const problemCount = problems.length;
  // 区切りで行が分かれると、当たった問題の最後の行と当たらなかった問題の最後の行がどちらも欠けうるので、1行分と区切りの高さを空けて収める。
  const isSplit = matchedCount !== null;

  // ピースの大きさと列の数は、台紙の場所の大きさと問題の数で決まるので、場所の大きさを見張って決め直す。
  useLayoutEffect(() => {
    const area = scrollerRef.current;
    if (area === null) {
      return;
    }
    function updateFit() {
      if (area === null) {
        return;
      }
      const { width, height } = area.getBoundingClientRect();
      const next = isSplit
        ? fitSplitSheet(width, height, problemCount)
        : fitZukanSheet(width, height, problemCount);
      setFit((current) =>
        current?.columnCount === next?.columnCount &&
        current?.pieceSize === next?.pieceSize
          ? current
          : next,
      );
    }
    updateFit();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateFit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [scrollerRef, problemCount, isSplit]);

  function selectSquare(problem: ZukanProblem) {
    setLastSelectedProblemId(problem.problemId);
    onSelect(problem);
  }

  function selectSquareAt(index: number | null) {
    const problem = index === null ? undefined : problems[index];
    if (problem === undefined || index === scrubbedIndexRef.current) {
      return;
    }
    scrubbedIndexRef.current = index;
    if (problem.problemId !== selectedProblemId) {
      selectSquare(problem);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (selectionDisabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    scrubbedIndexRef.current = null;
    // 指がピースの外へ出ても、押さえている間は台紙がなぞる操作を受け続ける。
    event.currentTarget.setPointerCapture?.(event.pointerId);
    selectSquareAt(findSquareIndexAt(event.clientX, event.clientY));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (
      selectionDisabled ||
      !event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      return;
    }
    selectSquareAt(findSquareIndexAt(event.clientX, event.clientY));
  }

  /** キーで押したとき（Enter・Space）。指とマウスは、押さえた時点で選び終えている。 */
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    const problem = index === null ? undefined : problems[index];
    if (
      !selectionDisabled &&
      problem !== undefined &&
      problem.problemId !== selectedProblemId
    ) {
      selectSquare(problem);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = findSquareIndex(event.target);
    const problem = index === null ? undefined : problems[index];
    const position =
      problem === undefined ? undefined : positions.get(problem.problemId);
    if (position === undefined || fit === null) {
      return;
    }
    const nextPosition = findNextSquareIndex(
      event.key,
      position,
      arrangedProblems.length,
      fit.columnCount,
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

  const columnCount = fit?.columnCount ?? 1;
  return (
    <div ref={scrollerRef} className="flex min-h-0 flex-1 flex-col justify-center">
      <div
        ref={gridRef}
        role="group"
        aria-label={`${getDifficultyLabel(difficulty)}の問題`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={
          {
            "--piece": `${fit?.pieceSize ?? 0}px`,
            gridTemplateColumns: `repeat(${columnCount}, var(--piece))`,
          } as CSSProperties
        }
        // 場所の大きさが分かるまでは、ピースを描かずに場所だけを取る。
        className={`isolate grid touch-none select-none [&>[data-filtered-out]]:order-2 ${fit === null ? "invisible" : ""}`}
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
  );
}

/** 絞り込みの区切りで2つに分かれた台紙の並べ方。区切りの高さと、分かれて増える1行分を空けて収める。 */
function fitSplitSheet(
  width: number,
  height: number,
  pieceCount: number,
): ZukanSheetFit | null {
  const fit = fitZukanSheet(width, height - FILTER_BOUNDARY_HEIGHT, pieceCount);
  return fit === null
    ? null
    : (fitZukanSheet(
        width,
        height - FILTER_BOUNDARY_HEIGHT - fit.pieceSize,
        pieceCount,
      ) ?? fit);
}

export const ZukanProblemSheet = memo(ZukanProblemSheetContent);

export const _private = { findNextSquareIndex };
