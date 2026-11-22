export type RackRow = {
  top: number;
  bottom: number;
};

export type RackTube = {
  bottleIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RackLayout = {
  width: number;
  height: number;
  tubeWidth: number;
  tubeHeight: number;
  left: number;
  right: number;
  rows: RackRow[];
  /** 穴をあける位置（試験管の左端）。どの段も同じ列に穴をあける。 */
  columnLefts: number[];
  tubes: RackTube[];
};

/**
 * 持ち上げは CSS の `translate` で行うので、その分を除いて置かれている位置を求める。
 */
function getLiftY(element: HTMLElement): number {
  const translateY = getComputedStyle(element).translate.split(" ")[1];
  const value = translateY ? Number.parseFloat(translateY) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function measureRackLayout(
  container: HTMLElement,
  bottles: readonly HTMLElement[],
): RackLayout | null {
  const containerRect = container.getBoundingClientRect();
  const tubes: RackTube[] = bottles.map((element, bottleIndex) => {
    const rect = element.getBoundingClientRect();
    return {
      bottleIndex,
      left: rect.left - containerRect.left,
      top: rect.top - getLiftY(element) - containerRect.top,
      width: rect.width,
      height: rect.height,
    };
  });
  const first = tubes[0];
  if (!first || first.width <= 0) {
    return null;
  }

  const rows: RackRow[] = [];
  for (const tube of [...tubes].sort((a, b) => a.top - b.top)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(tube.top - row.top) < tube.height / 2) {
      continue;
    }
    rows.push({ top: tube.top, bottom: tube.top + tube.height });
  }

  const columnLefts: number[] = [];
  for (const tube of [...tubes].sort((a, b) => a.left - b.left)) {
    const last = columnLefts[columnLefts.length - 1];
    if (last === undefined || tube.left - last > tube.width / 2) {
      columnLefts.push(tube.left);
    }
  }

  return {
    width: containerRect.width,
    height: containerRect.height,
    tubeWidth: first.width,
    tubeHeight: first.height,
    left: Math.min(...tubes.map((tube) => tube.left)),
    right: Math.max(...tubes.map((tube) => tube.left + tube.width)),
    rows,
    columnLefts,
    tubes,
  };
}
