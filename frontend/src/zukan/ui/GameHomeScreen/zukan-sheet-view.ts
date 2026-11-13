import type { ZukanVerticalSpan } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";

export function readZukanSheetView(scroller: Element): ZukanVerticalSpan {
  const { top, height } = scroller.getBoundingClientRect();
  // 下端を覆うものに隠れているところは、台紙が取っているスクロールの余白の分だけ除く。
  const coveredBottom =
    Number.parseFloat(getComputedStyle(scroller).scrollPaddingBottom) || 0;
  return { top, bottom: top + height - coveredBottom };
}
