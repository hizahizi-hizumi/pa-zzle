import type { ZukanVerticalSpan } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";

/** 台紙の見えている範囲。下端を覆うものに隠れているところは、台紙が取っているスクロールの余白の分だけ除く。 */
export function readZukanSheetView(scroller: Element): ZukanVerticalSpan {
  const { top, height } = scroller.getBoundingClientRect();
  const coveredBottom =
    Number.parseFloat(getComputedStyle(scroller).scrollPaddingBottom) || 0;
  return { top, bottom: top + height - coveredBottom };
}
