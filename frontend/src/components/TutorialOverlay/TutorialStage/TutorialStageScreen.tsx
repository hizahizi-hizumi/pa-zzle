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
  /** 作ったときに `intro` なら入口を見せる。もう一度始めたときは入口を見せずに最初の手順から始める。 */
  phase: TutorialPhase;
  /** 盤面が決め手を示している間、盤面の中だけを薄く覆う。 */
  spotlighting: boolean;
  progress: number;
  progressStepCount: number;
  finish: TutorialFinish;
  renderBoard: (intro: TutorialStageBoardIntro) => ReactNode;
  onIntroEnd: () => void;
  onRestart: () => void;
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

/** 達成の一言は、抑えていた強さを解いて、少し大きく弾んで出す。 */
const celebrateClassName =
  "animate-in fade-in-0 zoom-in-75 duration-(--duration-slow) ease-celebrate motion-reduce:animate-none";

/** 覚えたルールを1つ出してから、次を出すまでの間。 */
const RECAP_STAGGER_MS = 220;

/** 入口で大きく見せた名前を、上部の名前の位置へ移す間。 */
const NAME_MOVE_MS = 400;

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

/** 完成で盤面の下の欄が伸びたとき、盤面を新しい位置と大きさへ移す間。 */
const BOARD_SETTLE_MS = 400;

/** 前の位置と大きさから、今の位置と大きさへ移す変形（FLIP）。 */
function getMoveFromPreviousRect(current: DOMRect, previous: DOMRect): string {
  return `translate(${previous.left - current.left}px, ${previous.top - current.top}px) scale(${previous.width / current.width}, ${previous.height / current.height})`;
}

/** 画面の中で使う参照と、開いた側へ渡す参照の両方に、同じ要素を渡す。 */
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

/**
 * 上から、名前と進み具合、盤面、盤面の下の欄（一言と、入口・完成の操作）を、どの場面でも同じ位置と大きさで並べる。
 * 盤面の領域は、横に長い盤面にも縦に長い盤面にも同じだけ渡し、場面が替わっても変えない。
 * 入口はゴールの盤面に、何をするパズルかの一文を一言として添えるだけにし、「はじめる」で始めの盤面へ替えて、すぐ最初の手順に入る。
 */
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
  ref,
}: TutorialStageScreenProps) {
  const [introScene, setIntroScene] = useState<TutorialIntroScene | null>(
    phase === "intro" ? "goal" : null,
  );
  const completed = phase === "completed";
  // 解けた盤面の演出の間から、達成として一言を強める。
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
      { duration: BOARD_SETTLE_MS, easing: MOTION_EASING.standard },
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
        { duration: NAME_MOVE_MS, easing: MOTION_EASING.standard },
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
          <div className="ml-auto flex shrink-0">
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

        {/* ゴールを見せる間と、始めの盤面へ替える動きの間は、盤面を押せないようにする。 */}
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

        {/*
          盤面の下の欄。入口の名前と操作、一言、完成の振り返りと操作を上から詰めて並べる。
          解いている間は同じ高さにして盤面を動かさない。完成で振り返るルールが多く、この高さに収まらないゲームでは、
          操作が画面の外へ出ないよう、欄を伸ばして盤面の側を縮める。
        */}
        <footer className="flex min-h-52 shrink-0 flex-col items-center justify-start gap-3 px-4 pt-2 pb-3">
          {showsGoal && (
            // 初めての人に名前を覚えてもらえるよう、入口ではピクトグラムと名前を大きく見せる。
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
              // 完成の一言の後ろで、輪を2つ続けて広げる。結果の場面の祝い方と同じ、広がって消える輪で返す。
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
                "relative flex flex-col items-center gap-1 rounded-md px-3 py-1 text-balance text-center whitespace-pre-line [word-break:auto-phrase]",
                celebrating ? celebrateClassName : appearClassName,
              )}
            >
              <span
                className={celebrating ? "text-screen-title" : "text-heading"}
              >
                {shownMessage.headline}
              </span>
              {shownMessage.detail && (
                <span className="text-muted-foreground text-supporting">
                  {shownMessage.detail}
                </span>
              )}
            </p>
          </div>
          {showsGoal && (
            <Button type="button" size="lg" onClick={handleStart}>
              はじめる
            </Button>
          )}
          {completed && (
            // 覚えたルールを1つずつ確かめるように出してから、次の操作を出す。
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
                    {rule}
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
