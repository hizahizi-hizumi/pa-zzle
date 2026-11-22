export type CounterGlass = {
  bottleIndex: number;
  /** 置き場所の要素から見た位置（px）。持ち上げている分は除く。 */
  left: number;
  bottom: number;
  width: number;
  height: number;
};

export type CounterLayout = {
  /** 置き場所の要素の、画面の中での位置（px）。 */
  originLeft: number;
  originTop: number;
  viewportWidth: number;
  viewportHeight: number;
  /** カウンターの奥の縁（置き場所の要素から見た位置、px）。 */
  backEdgeY: number;
  glasses: readonly CounterGlass[];
};

/** 奥の列のグラスの足もとから、カウンターの奥の縁までの奥行き（グラスの高さに対する割合）。 */
const BACK_EDGE_DEPTH = 0.2;

/** 選んで持ち上げているグラスも、置かれている位置で測る。 */
function getLiftY(element: HTMLElement): number {
  const translateY = getComputedStyle(element).translate.split(" ")[1];
  const liftY = translateY ? Number.parseFloat(translateY) : 0;
  return Number.isFinite(liftY) ? liftY : 0;
}

export function measureCounterLayout(
  origin: HTMLElement,
  bottles: readonly HTMLElement[],
): CounterLayout | null {
  const originRect = origin.getBoundingClientRect();
  const glasses = bottles.map((bottle, bottleIndex): CounterGlass => {
    const rect = bottle.getBoundingClientRect();
    return {
      bottleIndex,
      left: rect.left - originRect.left,
      bottom: rect.bottom - getLiftY(bottle) - originRect.top,
      width: rect.width,
      height: rect.height,
    };
  });
  const firstRow = glasses.reduce<CounterGlass | null>(
    (highest, glass) =>
      highest === null || glass.bottom < highest.bottom ? glass : highest,
    null,
  );
  if (!firstRow) {
    return null;
  }

  return {
    originLeft: originRect.left,
    originTop: originRect.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    backEdgeY: firstRow.bottom - firstRow.height * BACK_EDGE_DEPTH,
    glasses,
  };
}
