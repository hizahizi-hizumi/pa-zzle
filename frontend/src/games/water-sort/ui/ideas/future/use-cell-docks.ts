import { type RefObject, useLayoutEffect, useState } from "react";

export type CellDock = {
  bottleIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CellDockRow = {
  left: number;
  right: number;
  bottom: number;
  cellHeight: number;
  cells: readonly CellDock[];
};

/**
 * 盤面の管が置かれている位置を、`root` の中の座標で測り、段ごとにまとめる。
 * 持ち上げている管も、置かれている位置で測る。管の本数が変わったら、管の要素を取り直して測る。
 */
export function useCellDocks(
  rootRef: RefObject<HTMLElement | null>,
  getBottleElements: () => readonly HTMLElement[],
  bottleCount: number,
): readonly CellDockRow[] {
  const [rows, setRows] = useState<readonly CellDockRow[]>([]);

  // 管の位置は DOM の配置で決まるので、配置が変わるたびに測り直す。
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || bottleCount === 0) {
      return;
    }

    function measure() {
      if (!root) {
        return;
      }
      setRows(measureCellDockRows(root, getBottleElements()));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const element of getBottleElements()) {
      observer.observe(element);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [rootRef, getBottleElements, bottleCount]);

  return rows;
}

export function measureCellDockRows(
  root: HTMLElement,
  elements: readonly HTMLElement[],
): readonly CellDockRow[] {
  const rootRect = root.getBoundingClientRect();
  const cells = elements.map((element, bottleIndex) => {
    const rect = element.getBoundingClientRect();
    const liftY = readTranslateY(element);
    return {
      bottleIndex,
      left: rect.left - rootRect.left,
      top: rect.top - liftY - rootRect.top,
      width: rect.width,
      height: rect.height,
    };
  });

  const rows: CellDock[][] = [];
  for (const cell of cells) {
    const row = rows.find(
      (candidate) =>
        Math.abs((candidate[0]?.top ?? 0) - cell.top) < cell.height / 2,
    );
    if (row) {
      row.push(cell);
    } else {
      rows.push([cell]);
    }
  }

  return rows.map((row) => ({
    left: Math.min(...row.map((cell) => cell.left)),
    right: Math.max(...row.map((cell) => cell.left + cell.width)),
    bottom: Math.max(...row.map((cell) => cell.top + cell.height)),
    cellHeight: row[0]?.height ?? 0,
    cells: row,
  }));
}

function readTranslateY(element: HTMLElement): number {
  const translateY = getComputedStyle(element).translate.split(" ")[1];
  const value = translateY ? Number.parseFloat(translateY) : 0;
  return Number.isFinite(value) ? value : 0;
}
