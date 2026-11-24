export type RackRow = {
  top: number;
  bottom: number;
};

export type RackLayout = {
  /** 盤面より上に並ぶ見出しと進み具合の、文字とボタンの下の端（入れ物の座標）。盤面がそれらの下に無ければ、画面の上の端。 */
  headingBottom: number;
  /** 盤面より下に並ぶ操作と文字（プレイ画面の待った・手詰まりの知らせ、チュートリアルの一言）を置く箱の上の端（入れ物の座標）。盤面がそれらの上に無ければ `null`。 */
  footerTop: number | null;
  width: number;
  height: number;
  tubeWidth: number;
  tubeHeight: number;
  left: number;
  right: number;
  rows: RackRow[];
};

/**
 * 持ち上げは CSS の `translate` で行うので、その分を除いて置かれている位置を求める。
 */
function getLiftY(element: HTMLElement): number {
  const translateY = getComputedStyle(element).translate.split(" ")[1];
  const value = translateY ? Number.parseFloat(translateY) : 0;
  return Number.isFinite(value) ? value : 0;
}

/**
 * 盤面を置く `main` より前に並ぶ要素（プレイ画面の見出し、チュートリアルの見出しと進み具合）の、文字とボタンの下の端（viewport の px）。
 * 見出しの箱の下の、何も描かない余白は含めない。地のように重ねて置いた要素は並びに入らないので除く。`main` の外なら画面の上の端。
 */
function getHeadingContentBottom(container: HTMLElement): number {
  const main = container.closest("main");
  const bottoms: number[] = [];
  for (
    let sibling = main?.previousElementSibling;
    sibling;
    sibling = sibling.previousElementSibling
  ) {
    const { position } = getComputedStyle(sibling);
    if (position === "absolute" || position === "fixed") {
      continue;
    }
    for (const child of sibling.children) {
      bottoms.push(child.getBoundingClientRect().bottom);
    }
  }
  return bottoms.length > 0 ? Math.max(...bottoms) : 0;
}

/**
 * 盤面を置く `main` より後ろに並ぶ要素（プレイ画面とチュートリアルの下の操作と文字）の箱の上の端（viewport の px）。
 * 手詰まりの知らせのように後から出る文字もこの箱の中に出るので、中身ではなく箱で測る。地のように重ねて置いた要素は並びに入らないので除く。
 */
function getFooterTop(container: HTMLElement): number | null {
  const main = container.closest("main");
  for (
    let sibling = main?.nextElementSibling;
    sibling;
    sibling = sibling.nextElementSibling
  ) {
    const { position } = getComputedStyle(sibling);
    if (position !== "absolute" && position !== "fixed") {
      return sibling.getBoundingClientRect().top;
    }
  }
  return null;
}

export function measureRackLayout(
  container: HTMLElement,
  bottles: readonly HTMLElement[],
): RackLayout | null {
  const containerRect = container.getBoundingClientRect();
  const tubes = bottles.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
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
  const footerTop = getFooterTop(container);

  const rows: RackRow[] = [];
  for (const tube of [...tubes].sort((a, b) => a.top - b.top)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(tube.top - row.top) < tube.height / 2) {
      continue;
    }
    rows.push({ top: tube.top, bottom: tube.top + tube.height });
  }

  return {
    headingBottom: getHeadingContentBottom(container) - containerRect.top,
    footerTop: footerTop === null ? null : footerTop - containerRect.top,
    width: containerRect.width,
    height: containerRect.height,
    tubeWidth: first.width,
    tubeHeight: first.height,
    left: Math.min(...tubes.map((tube) => tube.left)),
    right: Math.max(...tubes.map((tube) => tube.left + tube.width)),
    rows,
  };
}
