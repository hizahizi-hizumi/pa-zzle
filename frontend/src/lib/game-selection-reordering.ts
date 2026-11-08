export type ReorderPosition = {
  sourceIndex: number;
  dropIndex: number;
  height: number;
};

const scrollEdge = 48;
const maxScrollStep = 16;

export function findDropIndex(
  itemCenters: readonly number[],
  pointerY: number,
  sourceIndex: number,
): number {
  let crossed = 0;
  for (const center of itemCenters) {
    if (pointerY >= center) crossed++;
  }
  return Math.max(
    0,
    Math.min(itemCenters.length - 1, crossed - Number(crossed > sourceIndex)),
  );
}

export function findRowShift(
  index: number,
  drag: ReorderPosition | null,
): number {
  if (!drag) return 0;
  const { sourceIndex, dropIndex, height } = drag;
  if (index === sourceIndex) return (dropIndex - sourceIndex) * height;
  if (sourceIndex < dropIndex && index > sourceIndex && index <= dropIndex) {
    return -height;
  }
  if (sourceIndex > dropIndex && index >= dropIndex && index < sourceIndex) {
    return height;
  }
  return 0;
}

export function findAutoScrollStep(
  clientY: number,
  listTop: number,
  listBottom: number,
): number {
  const edge = Math.min(scrollEdge, (listBottom - listTop) / 3);
  const distanceFromTop = clientY - listTop;
  const distanceFromBottom = listBottom - clientY;
  if (distanceFromTop < edge) {
    return -Math.min(maxScrollStep, (edge - distanceFromTop) / 3);
  }
  if (distanceFromBottom < edge) {
    return Math.min(maxScrollStep, (edge - distanceFromBottom) / 3);
  }
  return 0;
}

export function findKeyboardDestination(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  switch (key) {
    case "ArrowUp":
      return Math.max(0, currentIndex - 1);
    case "ArrowDown":
      return Math.min(itemCount - 1, currentIndex + 1);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return null;
  }
}
