import { Check, X } from "lucide-react";
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { BrowserBottomSurface } from "@/components/BrowserBottomSurface";
import { GamePictogram } from "@/components/GamePictogram";
import { PhrasedText } from "@/components/PhrasedText";
import { TutorialFocusScrim } from "@/components/TutorialOverlay/TutorialFocusScrim";
import type {
  TutorialFinish,
  TutorialIntroScene,
} from "@/components/TutorialOverlay/TutorialScreen";
import { TUTORIAL_SPOTLIGHT_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDifficultyLabel } from "@/games/difficulty";
import type {
  TutorialIntro,
  TutorialMessage,
  TutorialPhase,
} from "@/games/tutorial";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * 入口のうち、盤面が受け持つ場面。
 * - `scene`: 今見せる場面。`goal` は解き終えた盤面、`start` は解き終えた盤面から始めの盤面へ替える動き。入口を終えた後は `null` で、解いている盤面を見せる。
 * - `playing`: 場面の動きを見せる間。
 * - `onSceneEnd`: 場面の動きを終えたら呼ぶ。
 */
export type TutorialStageBoardIntro = {
  scene: TutorialIntroScene | null;
  playing: boolean;
  onSceneEnd: () => void;
};

type TutorialStageScreenProps = {
  title: string;
  pictogramSvg: string;
  background: ReactNode;
  intro: TutorialIntro;
  recap: readonly string[];
  message: TutorialMessage;
  /** 作ったときの値が `intro` のときだけ入口を見せる。 */
  phase: TutorialPhase;
  spotlighting: boolean;
  progress: number;
  progressStepCount: number;
  finish: TutorialFinish;
  renderBoard: (intro: TutorialStageBoardIntro) => ReactNode;
  onIntroEnd: () => void;
  onRestart: () => void;
  onRequestHint: (() => void) | null;
  onOpenHowToPlay: (() => void) | null;
  /** 画面そのもの。開いたときのフォーカスを置く。 */
  ref?: Ref<HTMLDivElement>;
};

function getFinishLabel(finish: TutorialFinish): string {
  switch (finish.entry) {
    case "home":
      return `${getDifficultyLabel(finish.difficulty)}を遊ぶ`;
    case "play":
      return "プレイに戻る";
  }
}

const celebrateClassName =
  "animate-in fade-in-0 zoom-in-75 duration-(--duration-slow) ease-celebrate motion-reduce:animate-none";

const RECAP_STAGGER_MS = 220;

const INTRO_NAME_TO_HEADER_MS = 400;

/**
 * 入口で大きく見せた名前の位置と大きさから、上部の名前へ移す変形。
 * 上部の要素そのものを、大きな名前に重なる変形から動かし始める（FLIP）。
 */
function getMoveFromIntroName(target: HTMLElement, source: HTMLElement) {
  const targetRect = target.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const scale = sourceRect.width / targetRect.width;
  return `translate(${sourceRect.left - targetRect.left}px, ${sourceRect.top - targetRect.top}px) scale(${scale})`;
}

const BOARD_SETTLE_ON_COMPLETE_MS = 400;

/** 前の位置と大きさから、今の位置と大きさへ移す変形（FLIP）。 */
function getMoveFromPreviousRect(current: DOMRect, previous: DOMRect): string {
  return `translate(${previous.left - current.left}px, ${previous.top - current.top}px) scale(${previous.width / current.width}, ${previous.height / current.height})`;
}

function mergeRefs(
  inner: RefObject<HTMLDivElement | null>,
  outer: Ref<HTMLDivElement> | undefined,
): (element: HTMLDivElement | null) => void {
  return function setElement(element) {
    inner.current = element;
    if (typeof outer === "function") {
      outer(element);
    } else if (outer) {
      outer.current = element;
    }
  };
}

const appearClassName =
  "animate-in fade-in-0 slide-in-from-bottom-1 duration-(--duration-slow) ease-enter motion-reduce:animate-none";

export function TutorialStageScreen({
  title,
  pictogramSvg,
  background,
  intro,
  recap,
  message,
  phase,
  spotlighting,
  progress,
  progressStepCount,
  finish,
  renderBoard,
  onIntroEnd,
  onRestart,
  onRequestHint,
  onOpenHowToPlay,
  ref,
}: TutorialStageScreenProps) {
  const [introScene, setIntroScene] = useState<TutorialIntroScene | null>(
    phase === "intro" ? "goal" : null,
  );
  const completed = phase === "completed";
  const celebrating = phase === "solved" || completed;
  const showsGoal = introScene === "goal";
  const rootRef = useRef<HTMLDivElement>(null);
  const pictogramRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const introPictogramRef = useRef<HTMLSpanElement>(null);
  const introTitleRef = useRef<HTMLSpanElement>(null);
  const boardAreaRef = useRef<HTMLElement>(null);
  const boardRectRef = useRef<DOMRect | null>(null);
  const settledCompletedRef = useRef(completed);
  const shownMessage: TutorialMessage = showsGoal
    ? { headline: intro.purpose, detail: intro.goalCaption }
    : message;

  const handleSceneEnd = useCallback(() => {
    setIntroScene((scene) => (scene === "start" ? null : scene));
  }, []);

  // 完成で振り返りと操作が出ると、盤面の下の欄が伸びて盤面が縮む。盤面を飛ばさず、前の位置と大きさから滑らかに移す。
  useLayoutEffect(() => {
    const board = boardAreaRef.current?.firstElementChild;
    if (!(board instanceof HTMLElement)) {
      return;
    }
    const previous = boardRectRef.current;
    const current = board.getBoundingClientRect();
    boardRectRef.current = current;
    const justCompleted = completed && !settledCompletedRef.current;
    settledCompletedRef.current = completed;
    const moved =
      previous !== null &&
      (previous.width !== current.width || previous.top !== current.top);
    if (
      !justCompleted ||
      !moved ||
      current.width === 0 ||
      prefersReducedMotion() ||
      typeof board.animate !== "function"
    ) {
      return;
    }
    board.animate(
      [
        {
          transform: getMoveFromPreviousRect(current, previous),
          transformOrigin: "0 0",
        },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: BOARD_SETTLE_ON_COMPLETE_MS, easing: MOTION_EASING.standard },
    );
  });

  /** 大きな名前が消える前に位置を測り、上部の名前をそこから元の位置へ動かす。動きを減らす設定では、替えるだけにする。 */
  function moveNameToHeader(): void {
    if (prefersReducedMotion()) {
      return;
    }
    const pairs = [
      [pictogramRef.current, introPictogramRef.current],
      [titleRef.current, introTitleRef.current],
    ] as const;
    for (const [target, source] of pairs) {
      if (!target || !source || typeof target.animate !== "function") {
        continue;
      }
      target.animate(
        [
          {
            transform: getMoveFromIntroName(target, source),
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: INTRO_NAME_TO_HEADER_MS, easing: MOTION_EASING.standard },
      );
    }
  }

  function handleStart(): void {
    moveNameToHeader();
    setIntroScene("start");
    onIntroEnd();
  }

  function handleFinish(): void {
    if (finish.entry === "home") {
      finish.onStartPlay();
    } else {
      finish.onReturnToPlay();
    }
  }

  return (
    <div
      ref={mergeRefs(rootRef, ref)}
      tabIndex={-1}
      className="relative isolate flex min-h-0 flex-1 flex-col outline-none"
    >
      {/* プレイ画面と同じ組み立てで、ブラウザの上端と下端の色をこの地につなげる（地・上端に留まるブランドの帯・下端の面）。 */}
      <div
        aria-hidden="true"
        data-browser-surface="child"
        className="absolute inset-0 -z-10"
      >
        {background}
      </div>
      <DialogDescription className="sr-only">チュートリアル</DialogDescription>
      <BrandIdentityHeader surface="game" pinned />
      <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <header className="flex h-11 shrink-0 items-center gap-2 pr-3 pl-4">
          {/* 入口では名前を盤面の下の欄に大きく見せるので、上部の名前は伏せておき、始めるときに大きな名前の位置から動かして見せる。 */}
          <span
            ref={pictogramRef}
            className={cn("size-8 shrink-0", showsGoal && "opacity-0")}
          >
            <GamePictogram svg={pictogramSvg} />
          </span>
          <DialogTitle
            ref={titleRef}
            className={cn(
              "min-w-0 truncate text-play-context",
              showsGoal && "opacity-0",
            )}
          >
            {title}
          </DialogTitle>
          <div className="ml-auto flex shrink-0 items-center">
            {onOpenHowToPlay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenHowToPlay}
              >
                遊び方
              </Button>
            )}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="閉じる"
              >
                <X />
              </Button>
            </DialogClose>
          </div>
        </header>
        <div className="flex shrink-0 items-center gap-3 px-4">
          <div
            role="progressbar"
            aria-label="チュートリアルの進み具合"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10"
          >
            <div
              className="h-full origin-left rounded-full bg-foreground transition-transform duration-(--duration-slow) ease-standard motion-reduce:transition-none"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 text-muted-foreground text-play-meta tabular-nums"
          >
            {Math.round(progress * progressStepCount)} / {progressStepCount}
          </span>
        </div>

        <main
          ref={boardAreaRef}
          inert={introScene !== null}
          className="flex min-h-0 flex-1 items-end justify-center px-4 [container-type:size]"
        >
          {renderBoard({
            scene: introScene,
            playing: introScene === "start",
            onSceneEnd: handleSceneEnd,
          })}
        </main>

        {/* 振り返るルールが多いと最低の高さに収まらないので、操作が画面の外へ出ないよう、欄を伸ばして盤面の側を縮める。 */}
        <footer className="flex min-h-52 shrink-0 flex-col items-center justify-start gap-3 px-4 pt-2 pb-3">
          {showsGoal && (
            // 上部と同じ並びを同じ比で大きくし、上部へ移すときにピクトグラムと名前が交差しないようにする。
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none flex items-center justify-center gap-3",
                appearClassName,
              )}
            >
              <span ref={introPictogramRef} className="size-10 shrink-0">
                <GamePictogram svg={pictogramSvg} />
              </span>
              {/* 上部の名前へ移すときに字の太さが変わって見えないよう、上部と同じ太さで大きくする。 */}
              <span
                ref={introTitleRef}
                className="font-semibold text-screen-title"
              >
                {title}
              </span>
            </div>
          )}
          <div aria-live="polite" className="relative flex justify-center">
            {celebrating && (
              <span
                aria-hidden="true"
                data-tutorial-celebration=""
                className="pointer-events-none absolute -top-4 left-1/2 -ml-8 size-16 motion-reduce:hidden"
              >
                <span className="absolute inset-0 animate-tutorial-complete-pulse rounded-full border-(length:--border-width-strong) border-foreground" />
                <span className="absolute inset-0 animate-tutorial-complete-pulse rounded-full border-(length:--border-width-normal) border-foreground delay-300" />
              </span>
            )}
            <p
              key={`${shownMessage.headline}\n${shownMessage.detail ?? ""}`}
              {...{ [TUTORIAL_SPOTLIGHT_ATTRIBUTE]: "" }}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-md px-3 py-1 text-balance text-center whitespace-pre-line [overflow-wrap:anywhere] [word-break:keep-all]",
                celebrating ? celebrateClassName : appearClassName,
              )}
            >
              <span
                className={celebrating ? "text-screen-title" : "text-heading"}
              >
                <PhrasedText text={shownMessage.headline} />
              </span>
              {shownMessage.detail && (
                <span className="text-muted-foreground text-supporting">
                  <PhrasedText text={shownMessage.detail} />
                </span>
              )}
            </p>
          </div>
          {showsGoal && (
            <Button type="button" size="lg" onClick={handleStart}>
              はじめる
            </Button>
          )}
          {onRequestHint && introScene === null && phase === "playing" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={appearClassName}
              onClick={onRequestHint}
            >
              ヒント
            </Button>
          )}
          {completed && (
            <>
              <ul aria-label="覚えたルール" className="flex flex-col gap-1">
                {recap.map((rule, index) => (
                  <li
                    key={rule}
                    className={cn(
                      "flex items-center gap-2 text-supporting fill-mode-backwards",
                      appearClassName,
                    )}
                    style={{ animationDelay: `${index * RECAP_STAGGER_MS}ms` }}
                  >
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                    <span className="[overflow-wrap:anywhere] [word-break:keep-all]">
                      <PhrasedText text={rule} />
                    </span>
                  </li>
                ))}
              </ul>
              <div
                className={cn(
                  "flex gap-2 fill-mode-backwards",
                  appearClassName,
                )}
                style={{
                  animationDelay: `${recap.length * RECAP_STAGGER_MS}ms`,
                }}
              >
                <Button type="button" size="lg" onClick={handleFinish}>
                  {getFinishLabel(finish)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onRestart}
                >
                  もう一度
                </Button>
              </div>
            </>
          )}
        </footer>
      </div>
      <BrowserBottomSurface surface="game" />
      <TutorialFocusScrim
        scope="area"
        active={spotlighting && introScene === null && phase === "playing"}
        containerRef={rootRef}
      />
    </div>
  );
}
