import type { PointerEvent, TouchEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { playCarouselMoveSound } from "@/components/app-decision-sound";
import { GameSelectionSlide } from "@/components/GameSelectionGallery/GameSelectionCarousel/GameSelectionSlide";
import type { DifficultyLevel } from "@/games/difficulty";
import { prefersReducedMotion } from "@/lib/motion";
import type { Path } from "@/router";

type GameSelectionCarouselProps = {
  games: readonly {
    name: string;
    pictogramSvg: string;
    pictogramShowcaseSvg?: string;
    to: Path;
  }[];
  selectedIndex: number;
  continuation: { difficulty: DifficultyLevel; attemptedCount: number } | null;
  continuationId: string;
  colorsInGame: Path | null;
  isCovered: boolean;
  onSelect: (index: number) => void;
};

type MouseGesture = {
  pointerId: number;
  startX: number;
  startScroll: number;
  dragged: boolean;
};

// iOS は指が触れている間に書き換えたスクロール位置を、指を離すと元へ戻す。周を移すのは指を離して止まってからにするので、ひと続きの操作で端に着かないだけの周を並べ、中央の周から始める。
const LAP_COUNT = 15;
const MIDDLE_LAP = Math.floor(LAP_COUNT / 2);
/** スクロールの終わりの知らせが来ないときに、止まったとみなすまでの時間。 */
const SCROLL_SETTLE_MS = 140;
/** 指で触れてから、スクロールの終わりの知らせを「前のスクロールを指で止めた知らせ」とみなす時間。 */
const TOUCH_INTERRUPT_MS = 300;

// offsetLeft は整数に丸められる。隣どうしの差を間隔にすると、周の数だけ並んだ先で丸めの誤差が積み重なるので、両端の差を枚数で割る。
function slideStep(scroller: HTMLDivElement): number {
  const first = scroller.firstElementChild as HTMLElement | null;
  const last = scroller.lastElementChild as HTMLElement | null;
  if (!first || !last || first === last) return 0;
  return (last.offsetLeft - first.offsetLeft) / (scroller.children.length - 1);
}

function centeredSlide(
  scroller: HTMLDivElement,
  scrollLeft = scroller.scrollLeft,
): number {
  const first = scroller.firstElementChild as HTMLElement | null;
  if (!first) return 0;
  const step = slideStep(scroller);
  if (step <= 0) return 0;
  const center = scrollLeft + scroller.clientWidth / 2;
  const firstCenter = first.offsetLeft + first.offsetWidth / 2;
  return Math.max(
    0,
    Math.min(
      scroller.children.length - 1,
      Math.round((center - firstCenter) / step),
    ),
  );
}

const slidesNearFocus = new WeakMap<HTMLDivElement, Set<number>>();

// 並び順が変わるとスライドの要素が別の位置へ移るので、前の位置で付けた近さを残さない。
function clearVisualProximity(scroller: HTMLDivElement) {
  for (const index of slidesNearFocus.get(scroller) ?? []) {
    (scroller.children[index] as HTMLElement | undefined)?.style.removeProperty(
      "--proximity",
    );
  }
  slidesNearFocus.delete(scroller);
}

function updateVisualProximity(scroller: HTMLDivElement) {
  const children = scroller.children;
  const first = children[0] as HTMLElement | undefined;
  if (!first) return;
  const step = slideStep(scroller);
  if (step <= 0) return;
  const firstCenter = first.offsetLeft + first.offsetWidth / 2;
  const focus =
    (scroller.scrollLeft + scroller.clientWidth / 2 - firstCenter) / step;
  // 周を移す前後で見た目が変わらないよう、移す先になる中央の周の同じ位置にも同じ近さを付ける。
  const middleLapFocus =
    focus + middleLapShift(Math.round(focus), children.length / LAP_COUNT);
  // 周の数だけ複製が並ぶので、中央に近いスライドと、前に近かったスライドだけを書き換える。
  const near = new Set<number>();
  for (const center of [focus, middleLapFocus]) {
    for (let index = Math.floor(center); index <= Math.ceil(center); index++) {
      near.add(index);
    }
  }
  for (const index of new Set([
    ...near,
    ...(slidesNearFocus.get(scroller) ?? []),
  ])) {
    const child = children[index] as HTMLElement | undefined;
    if (!child) continue;
    const proximity = Math.max(
      0,
      1 - Math.abs(index - focus),
      1 - Math.abs(index - middleLapFocus),
    ).toFixed(3);
    if (child.style.getPropertyValue("--proximity") !== proximity) {
      child.style.setProperty("--proximity", proximity);
    }
  }
  slidesNearFocus.set(scroller, near);
}

function closestCopy(index: number, reference: number, count: number): number {
  if (count < 2) return index;
  return Array.from(
    { length: LAP_COUNT },
    (_, lap) => index + lap * count,
  ).reduce((closest, candidate) =>
    Math.abs(candidate - reference) < Math.abs(closest - reference)
      ? candidate
      : closest,
  );
}

function middleLapSlide(index: number, count: number): number {
  return count > 1 ? MIDDLE_LAP * count + index : index;
}

function middleLapShift(physicalIndex: number, count: number): number {
  return count > 1
    ? (MIDDLE_LAP - Math.floor(physicalIndex / count)) * count
    : 0;
}

export function GameSelectionCarousel({
  games,
  selectedIndex,
  continuation,
  continuationId,
  colorsInGame,
  isCovered,
  onSelect,
}: GameSelectionCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mouseGesture = useRef<MouseGesture | null>(null);
  const suppressClick = useRef(false);
  const initializedOrder = useRef("");
  const focusedSlide = useRef(middleLapSlide(selectedIndex, games.length));
  const selectedGameIndex = useRef(selectedIndex);
  const isNavigating = useRef(false);
  const isTouching = useRef(false);
  const touchStartedAt = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);
  const lastMoveSoundAt = useRef(-Infinity);
  const [activeSlide, setActiveSlide] = useState(
    middleLapSlide(selectedIndex, games.length),
  );
  const [mouseDragging, setMouseDragging] = useState(false);
  const count = games.length;
  const orderKey = games.map(({ to }) => to).join("|");

  const scrollToSlide = useCallback(
    (index: number, behavior: ScrollBehavior) => {
      const scroller = scrollerRef.current;
      const slide = scroller?.children[index] as HTMLElement | undefined;
      if (!scroller || !slide) return;
      const left =
        slide.offsetLeft + slide.offsetWidth / 2 - scroller.clientWidth / 2;
      scroller.scrollTo({
        left,
        behavior: prefersReducedMotion() ? "instant" : behavior,
      });
      if (behavior === "instant") updateVisualProximity(scroller);
    },
    [],
  );

  const slideTo = useCallback(
    function slideTo(physicalIndex: number) {
      isNavigating.current = true;
      scrollToSlide(physicalIndex, "smooth");
    },
    [scrollToSlide],
  );

  const focusSlide = useCallback(
    function focusSlide(index: number, audible = false) {
      const previous = focusedSlide.current;
      if (previous === index) return;
      focusedSlide.current = index;
      setActiveSlide(index);
      if (audible && previous % count !== index % count) {
        const now = performance.now();
        if (now - lastMoveSoundAt.current >= 175) {
          playCarouselMoveSound();
          lastMoveSoundAt.current = now;
        }
      }
    },
    [count],
  );

  function recenterScroll(scroller: HTMLDivElement): number {
    const physicalIndex = centeredSlide(scroller);
    if (count < 2) return physicalIndex;
    const lapShift = middleLapShift(physicalIndex, count);
    if (!lapShift) return physicalIndex;
    const from = scroller.children[physicalIndex] as HTMLElement;
    const to = scroller.children[physicalIndex + lapShift] as HTMLElement;
    const offset = to.offsetLeft - from.offsetLeft;
    scroller.scrollLeft += offset;
    if (mouseGesture.current?.dragged) {
      mouseGesture.current.startScroll += offset;
    }
    return physicalIndex + lapShift;
  }

  function commitSlide(scroller: HTMLDivElement) {
    if (mouseGesture.current?.dragged) return;
    const physicalIndex = recenterScroll(scroller);
    focusSlide(physicalIndex);
    isNavigating.current = false;
    const logicalIndex = physicalIndex % count;
    if (selectedGameIndex.current !== logicalIndex) {
      selectedGameIndex.current = logicalIndex;
      onSelect(logicalIndex);
    }
  }

  useLayoutEffect(() => {
    selectedGameIndex.current = selectedIndex;
    if (!count) return;
    const orderChanged = initializedOrder.current !== orderKey;
    initializedOrder.current = orderKey;
    if (orderChanged) {
      const initial = middleLapSlide(selectedIndex, count);
      focusedSlide.current = initial;
      setActiveSlide(initial);
      if (scrollerRef.current) clearVisualProximity(scrollerRef.current);
      scrollToSlide(initial, "instant");
      return;
    }
    if (focusedSlide.current % count !== selectedIndex) {
      const nearest = closestCopy(selectedIndex, focusedSlide.current, count);
      focusSlide(nearest);
      scrollToSlide(nearest, "smooth");
    }
  }, [selectedIndex, count, orderKey, scrollToSlide, focusSlide]);

  // iOS は指を離して端から戻ったときにスクロールの終わりを知らせないので、動きが止んだことでも止まったとみなす。
  function settleAfterScroll(scroller: HTMLDivElement) {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!isTouching.current) commitSlide(scroller);
    }, SCROLL_SETTLE_MS);
  }

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function handleTouchRelease(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length > 0) return;
    isTouching.current = false;
    settleAfterScroll(event.currentTarget);
  }

  useEffect(() => {
    function handleResize() {
      const index = closestCopy(
        selectedGameIndex.current,
        focusedSlide.current,
        count,
      );
      scrollToSlide(index, "instant");
      focusedSlide.current = index;
      setActiveSlide(index);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [count, scrollToSlide]);

  function handleMouseDown(event: PointerEvent<HTMLDivElement>) {
    mouseGesture.current = null;
    suppressClick.current = false;
    isNavigating.current = true;
    // 指が触れている間は周を移せない。
    if (event.pointerType !== "mouse") return;
    const physicalIndex = recenterScroll(event.currentTarget);
    focusSlide(physicalIndex);
    updateVisualProximity(event.currentTarget);
    if (event.button !== 0) return;
    mouseGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: event.currentTarget.scrollLeft,
      dragged: false,
    };
  }

  function handleMouseMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = mouseGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientX - gesture.startX;
    if (!gesture.dragged && Math.abs(distance) < 6) return;
    if (!gesture.dragged) {
      gesture.dragged = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setMouseDragging(true);
    }
    event.currentTarget.scrollLeft = gesture.startScroll - distance;
  }

  function handleMouseUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = mouseGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    mouseGesture.current = null;
    if (!gesture.dragged) return;
    suppressClick.current = true;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nearest = centeredSlide(event.currentTarget);
    const step = slideStep(event.currentTarget);
    const distance = event.clientX - gesture.startX;
    const direction = Math.sign(-distance);
    const start = centeredSlide(event.currentTarget, gesture.startScroll);
    const target =
      nearest === start && Math.abs(distance) > step * 0.18
        ? Math.max(
            0,
            Math.min(
              event.currentTarget.children.length - 1,
              start + direction,
            ),
          )
        : nearest;
    setMouseDragging(false);
    scrollToSlide(target, "smooth");
  }

  if (!count) return null;
  const lapCount = count > 1 ? LAP_COUNT : 1;

  return (
    <div className="game-selection__carousel-region">
      <div
        className="game-selection__carousel"
        role="group"
        aria-roledescription="カルーセル"
        aria-label="左右にスライドしてパズルを切り替え"
        tabIndex={0}
        ref={scrollerRef}
        data-mouse-dragging={mouseDragging}
        onScroll={(event) => {
          const physicalIndex = centeredSlide(event.currentTarget);
          updateVisualProximity(event.currentTarget);
          focusSlide(physicalIndex, isNavigating.current);
          settleAfterScroll(event.currentTarget);
        }}
        onScrollEnd={(event) => {
          if (isTouching.current) {
            // iOS は動いている最中に指で触れると、触れた直後にスクロールの終わりを知らせる。指が触れている間は周を移せないので、止まった扱いにしない。
            const interruptedByTouch =
              performance.now() - touchStartedAt.current < TOUCH_INTERRUPT_MS;
            if (interruptedByTouch) return;
            // Chromium の端末エミュレーションのタッチは、スクロールが始まると指を離した知らせを届けない。そこでは、スクロールの終わりで指が離れたとみなす。
            isTouching.current = false;
          }
          commitSlide(event.currentTarget);
        }}
        onTouchStart={() => {
          isTouching.current = true;
          touchStartedAt.current = performance.now();
          window.clearTimeout(settleTimer.current);
        }}
        onTouchEnd={handleTouchRelease}
        onTouchCancel={handleTouchRelease}
        onWheel={(event) => {
          isNavigating.current = true;
          const physicalIndex = recenterScroll(event.currentTarget);
          focusSlide(physicalIndex);
          updateVisualProximity(event.currentTarget);
        }}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerCancel={() => {
          mouseGesture.current = null;
          setMouseDragging(false);
        }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!suppressClick.current || event.detail === 0) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          isNavigating.current = true;
          const next =
            event.key === "Home"
              ? closestCopy(0, focusedSlide.current, count)
              : event.key === "End"
                ? closestCopy(count - 1, focusedSlide.current, count)
                : Math.max(
                    0,
                    Math.min(
                      count * lapCount - 1,
                      focusedSlide.current +
                        (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  );
          focusSlide(next, true);
          scrollToSlide(next, "smooth");
        }}
      >
        {Array.from({ length: lapCount }, (_, lap) => lap).flatMap((lap) =>
          games.map((game, index) => {
            const physicalIndex = lap * count + index;
            const active = activeSlide === physicalIndex;
            // 周を移す前後で描き替えが要らないよう、移す先になる中央の周の複製も選んでいる姿で描く。
            const selected =
              active ||
              physicalIndex ===
                activeSlide + middleLapShift(activeSlide, count);
            const showsContinuation = selected && selectedIndex === index;
            return (
              <GameSelectionSlide
                key={`${lap}-${game.to}`}
                name={game.name}
                pictogramSvg={game.pictogramSvg}
                pictogramShowcaseSvg={game.pictogramShowcaseSvg}
                to={game.to}
                physicalIndex={physicalIndex}
                position={index + 1}
                count={count}
                active={active}
                selected={selected}
                isCovered={isCovered}
                colorsIn={colorsInGame === game.to && selectedIndex === index}
                continuation={showsContinuation ? continuation : null}
                continuationId={continuationId}
                onChoose={slideTo}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
