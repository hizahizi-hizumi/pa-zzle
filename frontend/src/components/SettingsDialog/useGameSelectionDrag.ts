import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  findAutoScrollStep,
  findDropIndex,
  findKeyboardDestination,
} from "@/lib/game-selection-reordering";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";

type DragState = {
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  grabX: number;
  grabY: number;
  width: number;
  height: number;
  sourceIndex: number;
  dropIndex: number;
};

type SettleState = DragState & {
  targetLeft: number;
  targetTop: number;
};

type UseGameSelectionDragProps = {
  orderedIds: readonly string[];
  onReorder: (gameId: string, destination: number) => void;
};

function getDropIndex(
  list: HTMLDivElement | null,
  clientY: number,
  sourceIndex: number,
): number {
  if (!list) return sourceIndex;
  const rows = list.querySelectorAll<HTMLElement>("[data-sort-item]");
  const localY = clientY - list.getBoundingClientRect().top + list.scrollTop;
  const centers = Array.from(
    rows,
    (row) => row.offsetTop + row.offsetHeight / 2,
  );
  return findDropIndex(centers, localY, sourceIndex);
}

export function useGameSelectionDrag({
  orderedIds,
  onReorder,
}: UseGameSelectionDragProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousPositionsRef = useRef<Map<string, number> | null>(null);
  const activeDragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settling, setSettling] = useState<SettleState | null>(null);
  const isDragging = drag !== null;

  function changeDrag(nextDrag: DragState | null): void {
    activeDragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function captureRowPositions(): void {
    const rows =
      listRef.current?.querySelectorAll<HTMLElement>("[data-sort-item]");
    if (!rows) return;
    previousPositionsRef.current = new Map(
      Array.from(rows, (row) => [
        row.dataset.sortItem ?? "",
        row.getBoundingClientRect().top,
      ]),
    );
  }

  function reorder(gameId: string, destination: number): void {
    if (orderedIds.indexOf(gameId) === destination) return;
    captureRowPositions();
    onReorder(gameId, destination);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || activeDragRef.current !== null) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest("[data-sort-handle]");
    const row = handle?.closest<HTMLElement>("[data-sort-item]");
    const id = row?.dataset.sortItem;
    if (!id || !row) return;

    event.preventDefault();
    const bounds = row.getBoundingClientRect();
    const sourceIndex = orderedIds.indexOf(id);
    setSettling(null);
    changeDrag({
      id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      grabX: event.clientX - bounds.left,
      grabY: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
      sourceIndex,
      dropIndex: sourceIndex,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const current = activeDragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    changeDrag({
      ...current,
      clientX: event.clientX,
      clientY: event.clientY,
      dropIndex: getDropIndex(
        listRef.current,
        event.clientY,
        current.sourceIndex,
      ),
    });
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>): void {
    const current = activeDragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const destination = getDropIndex(
      listRef.current,
      event.clientY,
      current.sourceIndex,
    );
    const list = listRef.current;
    const sourceRow = Array.from(
      list?.querySelectorAll<HTMLElement>("[data-sort-item]") ?? [],
    )[current.sourceIndex];
    const bounds = list?.getBoundingClientRect();
    if (sourceRow && list && bounds && destination !== current.sourceIndex) {
      setSettling({
        ...current,
        clientX: event.clientX,
        clientY: event.clientY,
        targetLeft: sourceRow.getBoundingClientRect().left,
        targetTop:
          bounds.top +
          sourceRow.offsetTop -
          list.scrollTop +
          (destination - current.sourceIndex) * current.height,
      });
    }
    if (destination === current.sourceIndex) captureRowPositions();
    changeDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    reorder(current.id, destination);
  }

  function cancelDrag(event: PointerEvent<HTMLDivElement>): void {
    if (activeDragRef.current?.pointerId !== event.pointerId) return;
    captureRowPositions();
    changeDrag(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest("[data-sort-handle]");
    const id = handle?.getAttribute("data-game-id");
    if (!id) return;
    const index = orderedIds.indexOf(id);
    const destination = findKeyboardDestination(
      event.key,
      index,
      orderedIds.length,
    );
    if (destination === null) return;
    event.preventDefault();
    reorder(id, destination);
  }

  useEffect(() => {
    if (!isDragging) return;
    let frame: number;
    function autoScroll(): void {
      const list = listRef.current;
      const current = activeDragRef.current;
      if (!list || !current) return;
      const bounds = list.getBoundingClientRect();
      const velocity = findAutoScrollStep(
        current.clientY,
        bounds.top,
        bounds.bottom,
      );
      if (velocity !== 0) {
        const before = list.scrollTop;
        list.scrollTop += velocity;
        if (list.scrollTop !== before) {
          const nextIndex = getDropIndex(
            list,
            current.clientY,
            current.sourceIndex,
          );
          if (nextIndex !== current.dropIndex) {
            const updated = { ...current, dropIndex: nextIndex };
            activeDragRef.current = updated;
            setDrag(updated);
          }
        }
      }
      frame = requestAnimationFrame(autoScroll);
    }
    frame = requestAnimationFrame(autoScroll);
    return () => cancelAnimationFrame(frame);
  }, [isDragging]);

  useLayoutEffect(() => {
    const previousPositions = previousPositionsRef.current;
    previousPositionsRef.current = null;
    if (!previousPositions || prefersReducedMotion()) return;
    const rows =
      listRef.current?.querySelectorAll<HTMLElement>("[data-sort-item]");
    for (const row of rows ?? []) {
      if (row.dataset.sortItem === settling?.id) continue;
      const previousTop = previousPositions.get(row.dataset.sortItem ?? "");
      if (previousTop === undefined || !row.animate) continue;
      const delta = previousTop - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      row.animate(
        [
          { transform: `translate3d(0, ${delta}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: MOTION_DURATION_MS.normal,
          easing: MOTION_EASING.standard,
        },
      );
    }
  });

  useLayoutEffect(() => {
    if (!settling) return;
    const overlay = overlayRef.current;
    if (!overlay?.animate || prefersReducedMotion()) {
      setSettling(null);
      return;
    }
    const animation = overlay.animate(
      [
        {
          transform: `translate3d(${settling.clientX - settling.grabX - settling.targetLeft}px, ${settling.clientY - settling.grabY - settling.targetTop}px, 0) scale(1.018)`,
        },
        { transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      {
        duration: MOTION_DURATION_MS.normal,
        easing: MOTION_EASING.standard,
        fill: "both",
      },
    );
    animation.finished.then(
      () => setSettling((current) => (current === settling ? null : current)),
      () => {},
    );
    return () => animation.cancel();
  }, [settling]);

  return {
    listRef,
    overlayRef,
    drag,
    settling,
    handlePointerDown,
    handlePointerMove,
    finishDrag,
    cancelDrag,
    handleKeyDown,
  };
}
