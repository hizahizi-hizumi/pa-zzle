import { type RefObject, useLayoutEffect, useState } from "react";

/** 待ったの欄（`h-28`）の高さ。 */
const UNDO_FOOTER_HEIGHT_PX = 112;
/**
 * 待ったの欄を置いたままにできる1升の幅の下限。押す対象の最小の大きさ（WCAG 2.2 の達成基準 2.5.8 の 24px）に、
 * 升の罫線と隣の升との押し違えの余裕を足した。375×667 で欄を置いた升（約30px）は欄を残し、
 * 320×568 で欄を置いた升（約20px）は欄を回す。
 */
const MIN_SQUARE_WIDTH_PX = 28;
/** 待ったの欄を戻すときの余裕。境目で欄を出し入れし続けないようにする。 */
const RESTORE_MARGIN_PX = 1;

/** 盤を置く欄と盤の今の大きさ。`squares*` は 9×9 の升の部分。 */
type PlayAreaMeasurement = {
  areaHeight: number;
  contentHeight: number;
  squaresWidth: number;
  squaresHeight: number;
  undoFooterShown: boolean;
};

/**
 * 待ったの欄を置いたときの1升の幅。盤は欄の幅と高さの両方に収まる大きさなので、今の升の幅と、
 * 欄を置いて残る高さに升を縦長の比のまま収めた幅の小さい方になる。升の外（駒台・直前の手の行・盤の縁）の高さは変わらない。
 */
function getSquareWidthWithUndoFooter({
  areaHeight,
  contentHeight,
  squaresWidth,
  squaresHeight,
  undoFooterShown,
}: PlayAreaMeasurement): number {
  const squareWidth = squaresWidth / 9;
  const squareHeight = squaresHeight / 9;
  if (squareHeight <= 0) return squareWidth;

  const heightWithUndoFooter =
    areaHeight - (undoFooterShown ? 0 : UNDO_FOOTER_HEIGHT_PX);
  const fixedHeight = contentHeight - squaresHeight;
  const heightLimitedSquareWidth =
    ((heightWithUndoFooter - fixedHeight) / 9) * (squareWidth / squareHeight);
  return Math.min(squareWidth, heightLimitedSquareWidth);
}

/** 待ったの欄を盤に回すか。回している間は、余裕を足した幅まで升が戻ってから欄を戻す。 */
function shouldMoveUndoToHand(
  squareWidthWithUndoFooter: number,
  movedToHand: boolean,
): boolean {
  return (
    squareWidthWithUndoFooter <
    MIN_SQUARE_WIDTH_PX + (movedToHand ? RESTORE_MARGIN_PX : 0)
  );
}

/**
 * 盤の下に待ったの欄を置くと升が小さくなりすぎる、背の低い画面か。
 * 欄を置いたときの1升の幅が `MIN_SQUARE_WIDTH_PX` を下回るなら背が低いとする。
 * `area` は盤の欄、`content` は盤と駒台のまとまりで、`[data-board-squares]` の升の部分を含む。
 */
export function useShortPlayArea(
  area: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): boolean {
  const [short, setShort] = useState(false);

  useLayoutEffect(() => {
    const areaElement = area.current;
    const contentElement = content.current;
    const squaresElement = contentElement?.querySelector(
      "[data-board-squares]",
    );
    if (
      !areaElement ||
      !contentElement ||
      !squaresElement ||
      typeof ResizeObserver !== "function"
    ) {
      return;
    }

    function update(): void {
      if (!areaElement || !contentElement || !squaresElement) return;
      const style = getComputedStyle(areaElement);
      const squaresRect = squaresElement.getBoundingClientRect();
      const areaHeight =
        areaElement.clientHeight -
        Number.parseFloat(style.paddingTop) -
        Number.parseFloat(style.paddingBottom);
      setShort((current) =>
        shouldMoveUndoToHand(
          getSquareWidthWithUndoFooter({
            areaHeight,
            contentHeight: contentElement.getBoundingClientRect().height,
            squaresWidth: squaresRect.width,
            squaresHeight: squaresRect.height,
            undoFooterShown: !current,
          }),
          current,
        ),
      );
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(areaElement);
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [area, content]);

  return short;
}

export const _private = {
  getSquareWidthWithUndoFooter,
  shouldMoveUndoToHand,
};
