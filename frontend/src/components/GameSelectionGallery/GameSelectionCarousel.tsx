import type { PointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

import {
  playCarouselMoveSound,
  playPlayStartSound,
} from "@/components/app-decision-sound";
import { GamePictogram } from "@/components/GamePictogram";
import { SelectedGamePictogram } from "@/components/GameSelectionGallery/SelectedGamePictogram";
import { Badge } from "@/components/ui/badge";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
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

function centeredSlide(
  scroller: HTMLDivElement,
  scrollLeft = scroller.scrollLeft,
): number {
  const first = scroller.firstElementChild as HTMLElement | null;
  const second = first?.nextElementSibling as HTMLElement | null;
  if (!first || !second) return 0;
  const step = second.offsetLeft - first.offsetLeft;
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

function updateVisualProximity(scroller: HTMLDivElement) {
  const children = Array.from(scroller.children) as HTMLElement[];
  const first = children[0];
  const second = children[1];
  if (!first || !second) return;
  const step = second.offsetLeft - first.offsetLeft;
  if (step <= 0) return;
  const firstCenter = first.offsetLeft + first.offsetWidth / 2;
  const focus =
    (scroller.scrollLeft + scroller.clientWidth / 2 - firstCenter) / step;
  for (const [index, child] of children.entries()) {
    const proximity = Math.max(0, 1 - Math.abs(index - focus)).toFixed(3);
    if (child.style.getPropertyValue("--proximity") !== proximity) {
      child.style.setProperty("--proximity", proximity);
    }
  }
}

function closestCopy(index: number, reference: number, count: number): number {
  if (count < 2) return index;
  return [index, index + count, index + 2 * count].reduce(
    (closest, candidate) =>
      Math.abs(candidate - reference) < Math.abs(closest - reference)
        ? candidate
        : closest,
  );
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
  const focusedSlide = useRef(games.length + selectedIndex);
  const selectedGameIndex = useRef(selectedIndex);
  const isNavigating = useRef(false);
  const lastMoveSoundAt = useRef(-Infinity);
  const [activeSlide, setActiveSlide] = useState(games.length + selectedIndex);
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
    const lapShift =
      physicalIndex < count ? count : physicalIndex >= count * 2 ? -count : 0;
    if (!lapShift) return physicalIndex;
    const first = scroller.firstElementChild as HTMLElement;
    const second = first.nextElementSibling as HTMLElement;
    const offset = lapShift * (second.offsetLeft - first.offsetLeft);
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
      const initial = count > 1 ? count + selectedIndex : selectedIndex;
      focusedSlide.current = initial;
      setActiveSlide(initial);
      scrollToSlide(initial, "instant");
      return;
    }
    if (focusedSlide.current % count !== selectedIndex) {
      const nearest = closestCopy(selectedIndex, focusedSlide.current, count);
      focusSlide(nearest);
      scrollToSlide(nearest, "smooth");
    }
  }, [selectedIndex, count, orderKey, scrollToSlide, focusSlide]);

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
    const physicalIndex = recenterScroll(event.currentTarget);
    focusSlide(physicalIndex);
    updateVisualProximity(event.currentTarget);
    if (event.pointerType !== "mouse" || event.button !== 0) return;
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
    const first = event.currentTarget.firstElementChild as HTMLElement | null;
    const step = first?.nextElementSibling
      ? (first.nextElementSibling as HTMLElement).offsetLeft - first.offsetLeft
      : 0;
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
  const laps =
    count > 1
      ? (["previous", "current", "next"] as const)
      : (["current"] as const);

  return (
    <div className="game-selection__carousel-region">
      <div
        className="game-selection__surface"
        data-screen-frame=""
        data-screen-shared="surface"
        aria-hidden="true"
      />
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
        }}
        onScrollEnd={(event) => commitSlide(event.currentTarget)}
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
                      count * laps.length - 1,
                      focusedSlide.current +
                        (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  );
          focusSlide(next, true);
          scrollToSlide(next, "smooth");
        }}
      >
        {laps.flatMap((lap, lapIndex) =>
          games.map((game, index) => {
            const physicalIndex = lapIndex * count + index;
            const active = activeSlide === physicalIndex;
            return (
              <Link
                key={`${lap}-${game.to}`}
                to={game.to}
                className="game-selection__slide"
                data-active={active}
                data-screen-content={active ? undefined : ""}
                aria-label={`${game.name}${active ? "を開く" : "を選択"}`}
                aria-describedby={
                  active && selectedIndex === index && continuation
                    ? continuationId
                    : undefined
                }
                tabIndex={active ? 0 : -1}
                draggable={false}
                onClick={(event) => {
                  if (active) {
                    playPlayStartSound();
                    return;
                  }
                  event.preventDefault();
                  isNavigating.current = true;
                  scrollToSlide(physicalIndex, "smooth");
                }}
              >
                <span
                  className="game-selection__figure"
                  data-screen-shared={active ? "pictogram" : undefined}
                >
                  {active ? (
                    <SelectedGamePictogram
                      pictogramSvg={game.pictogramSvg}
                      pictogramShowcaseSvg={game.pictogramShowcaseSvg}
                      size="hero"
                      motion={isCovered ? "rest" : "play"}
                      colorsIn={
                        colorsInGame === game.to && selectedIndex === index
                      }
                    />
                  ) : (
                    <GamePictogram svg={game.pictogramSvg} />
                  )}
                </span>
                <span className="game-selection__details">
                  <span
                    className="game-selection__position"
                    aria-hidden="true"
                    data-screen-content=""
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>/</span>
                    <span>{String(count).padStart(2, "0")}</span>
                  </span>
                  <span
                    className="game-selection__name"
                    data-screen-shared={active ? "title" : undefined}
                  >
                    {game.name}
                  </span>
                  <span className="game-selection__meta" data-screen-content="">
                    {active && selectedIndex === index && continuation && (
                      <Badge id={continuationId} variant="outline">
                        {getDifficultyLabel(continuation.difficulty)}
                        {continuation.attemptedCount > 0 &&
                          ` ・ 挑戦中 ${continuation.attemptedCount}問`}
                      </Badge>
                    )}
                  </span>
                </span>
              </Link>
            );
          }),
        )}
      </div>
    </div>
  );
}
