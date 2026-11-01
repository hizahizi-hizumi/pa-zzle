import { X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TutorialIntro, TutorialMessage } from "@/games/tutorial";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * 上部に並べるルール。手に入れるまでは中身を伏せる。
 * - `current`: 今の手順で示しているルール。一言で示したルールがどれかを、ルールの並びの側でも分かるようにする。
 */
export type TutorialRuleListItem = {
  id: string;
  label: string;
  earned: boolean;
  current: boolean;
};

/**
 * 終えたときの主な操作。開いた場所ごとに行き先が決まる。
 * - `selection`: 難易度選択から開いた。レベル1を始める。
 * - `play`: プレイ中に開いた。閉じてプレイに戻る。
 */
export type TutorialFinish =
  | { entry: "selection"; onStartPlay: () => void }
  | { entry: "play"; onReturnToPlay: () => void };

/**
 * 導入で、盤面が見せる場面。
 * - `goal`: 解き終えた盤面。
 * - `start`: 解き終えた盤面から始めの盤面へ移り、始めの盤面を見せる。
 */
export type TutorialIntroScene = "goal" | "start";

/**
 * 導入のうち、盤面が受け持つ場面。
 * - `scene`: 今見せる場面。導入を終えた後は `null` で、解いている盤面を見せる。
 * - `playing`: 場面の動きを見せる間。盤面が見えるまでと、動きを終えた後は `false` で、場面の終わりの盤面を見せる。
 * - `onSceneEnd`: 場面の動きを終えたら呼ぶ。動きを減らす設定では、動かさずにすぐ呼ぶ。
 */
export type TutorialBoardIntro = {
  scene: TutorialIntroScene | null;
  playing: boolean;
  onSceneEnd: () => void;
};

type TutorialScreenProps = {
  /** パズルの名前。チュートリアルはパズルの入口の1つなので、何のパズルかを盤面と一緒に見せる。 */
  title: string;
  /** パズル選択と同じピクトグラム。名前と一緒に見せる。 */
  pictogramSvg: string;
  intro: TutorialIntro;
  rules: readonly TutorialRuleListItem[];
  message: TutorialMessage;
  /** 導入を見せている間。開いたときと、もう一度始めたときに導入から始まる。 */
  introducing: boolean;
  completed: boolean;
  finish: TutorialFinish;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。 */
  renderBoard: (intro: TutorialBoardIntro) => ReactNode;
  /** 導入を終えたか、飛ばした。 */
  onIntroEnd: () => void;
  onRestart: () => void;
  /** 画面そのもの。開いたときのフォーカスを置く。 */
  ref?: Ref<HTMLDivElement>;
};

/**
 * 導入の段。開いたときは `name` から、もう一度始めたときは `start` から進む。
 * - `name`: 上部の領域の中央に、ピクトグラムと名前を大きく、その下に何をするパズルかの一文を出す。
 * - `goalAppearing`: その下に、解き終えた盤面とゴールの一言を出す。
 * - `goal`: 解き終えた盤面の動きを盤面に任せ、終えたら読む間だけ待つ。
 * - `start`: 始めの盤面へ移る動きを盤面に任せ、始まりの一言を添えて、終えたら読む間だけ待つ。
 * - `header`: 名前を上部へ移し、移し終える頃にルールと一言を出す。
 * - `reveal`: 名前がもう上部にあるときに、ルールと一言を出す。
 * - `done`: 導入を終えた。
 */
type IntroStage =
  | "name"
  | "goalAppearing"
  | "goal"
  | "start"
  | "header"
  | "reveal"
  | "done";

/** 名前が現れてから盤面を出すまで。 */
const BOARD_APPEAR_DELAY_MS = 300;
const BOARD_APPEAR_MS = 250;
/** 名前を上部へ移す間。ピクトグラムと名前は並んだまま一緒に動く。 */
const NAME_MOVE_MS = 400;
/** ルールと一言は、名前がその行を通り過ぎてから出す。`header` の見せ方の `delay-350` と同じ値。 */
const REVEAL_AFTER_NAME_DELAY_MS = 350;
const REVEAL_MS = 300;

/**
 * 盤面の場面を見せ終えてから、次へ進むまでの読む間。
 * 動きを減らす設定では、盤面の動きで場面を見せる間が無いので、そのぶん長く止めて読ませる。
 */
const sceneHoldMs = {
  animated: { goal: 1200, start: 1200 },
  still: { goal: 2800, start: 2200 },
} as const satisfies Record<
  "animated" | "still",
  Record<TutorialIntroScene, number>
>;

/**
 * 段ごとの見せ方。
 * - `introNameClassName`: 導入の間に大きく見せる名前と、何をするパズルかの一文。名前を上部へ移すときに消す。
 * - `rulesClassName`: ルールと一言。導入を終えた後は動かさない。
 * - `boardAreaClassName`: 盤面の領域。
 * - `scene`: 盤面が見せる場面。
 * - `scenePlaying`: 盤面に場面の動きを任せている間。
 * - `captionScene`: 盤面の下に、どの場面の一言を添えるか。
 * - `captionClassName`: 盤面の下の一言。
 * - `nextButtonClassName`: 盤面の下の「次へ」。導入を終える段では、一言と一緒に消す。
 */
const introStageViews = {
  name: {
    introNameClassName:
      "animate-in fade-in-0 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
    rulesClassName: "opacity-0",
    boardAreaClassName: "opacity-0",
    scene: "goal",
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
    nextButtonClassName: "",
  },
  goalAppearing: {
    introNameClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName:
      "animate-in fade-in-0 duration-250 ease-(--ease-enter) motion-reduce:animate-none",
    scene: "goal",
    scenePlaying: false,
    captionScene: "goal",
    captionClassName:
      "animate-in fade-in-0 duration-250 ease-(--ease-enter) motion-reduce:animate-none",
    nextButtonClassName: "",
  },
  goal: {
    introNameClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName: "",
    scene: "goal",
    scenePlaying: true,
    captionScene: "goal",
    captionClassName: "",
    nextButtonClassName: "",
  },
  start: {
    introNameClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName: "",
    scene: "start",
    scenePlaying: true,
    captionScene: "start",
    captionClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
    nextButtonClassName: "",
  },
  header: {
    introNameClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 delay-350 fill-mode-backwards ease-(--ease-enter)",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: "start",
    captionClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
    nextButtonClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
  },
  reveal: {
    introNameClassName: "",
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter)",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
    nextButtonClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
  },
  done: {
    introNameClassName: "",
    rulesClassName: "",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
    nextButtonClassName: "",
  },
} as const satisfies Record<
  IntroStage,
  {
    introNameClassName: string;
    rulesClassName: string;
    boardAreaClassName: string;
    scene: TutorialIntroScene | null;
    scenePlaying: boolean;
    captionScene: TutorialIntroScene | null;
    captionClassName: string;
    nextButtonClassName: string;
  }
>;

const finishLabels = {
  selection: "レベル1を遊ぶ",
  play: "プレイに戻る",
} as const satisfies Record<TutorialFinish["entry"], string>;

/**
 * 導入を動きで見せられるか。動きを減らす設定か、動きを描けない環境では、
 * 同じ段を動かさずに切り替え、どの段の止まった画面でも伝えることが分かるようにする。
 */
function canAnimateIntro(elements: readonly (HTMLElement | null)[]): boolean {
  return (
    !prefersReducedMotion() &&
    elements.every((element) => typeof element?.animate === "function")
  );
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

/**
 * 導入で大きく見せた名前の位置から、上部の名前の位置へ移す変形。
 * 上部の要素そのものを、導入の名前の位置に重ねた変形から動かし始める（FLIP）。
 */
function getMoveFromIntroName(
  target: HTMLElement,
  source: HTMLElement,
): string {
  const targetRect = target.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const scale = sourceRect.width / targetRect.width;
  return `translate(${sourceRect.left - targetRect.left}px, ${sourceRect.top - targetRect.top}px) scale(${scale})`;
}

/**
 * 開いたときに、パズルの名前と何をするパズルか、ゴールの盤面、始めの盤面を順に見せてから、1つの盤面を埋めながらルールを1つずつ身につけていく画面。
 * 盤面を主役にし、上部にパズルの名前と手に入れたルール、盤面の直上に短い一言だけを出す。
 * 導入は自分のペースで進められるよう、自動で進むほかに「次へ」で次の場面へ進められ、ほかのどこを押しても、どのキーでも飛ばせる。
 */
export function TutorialScreen({
  title,
  pictogramSvg,
  intro,
  rules,
  message,
  introducing,
  completed,
  finish,
  renderBoard,
  onIntroEnd,
  onRestart,
  ref,
}: TutorialScreenProps) {
  const [stage, setStage] = useState<IntroStage>(introducing ? "name" : "done");
  // 名前を上部の外で大きく見せている間。上部の名前は伏せ、大きな名前の下に何をするパズルかの一文を出す。
  const [nameCentered, setNameCentered] = useState(introducing);
  const rootRef = useRef<HTMLDivElement>(null);
  const pictogramRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const introPictogramRef = useRef<HTMLSpanElement>(null);
  const introTitleRef = useRef<HTMLSpanElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const animatedRef = useRef(false);
  const nameCenteredRef = useRef(nameCentered);
  const stageRef = useRef(stage);
  // 場面の終わりを一度だけ受け取るため、受け取った段を覚える。
  const endedStageRef = useRef<IntroStage | null>(null);
  const [sceneEnded, setSceneEnded] = useState(false);
  const timersRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const onIntroEndRef = useRef(onIntroEnd);
  const introPlaying = stage !== "done";

  useLayoutEffect(() => {
    onIntroEndRef.current = onIntroEnd;
    stageRef.current = stage;
    nameCenteredRef.current = nameCentered;
  });

  const stopIntroMotion = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    for (const animation of animationsRef.current) {
      animation.cancel();
    }
    timersRef.current = [];
    animationsRef.current = [];
    for (const element of [pictogramRef.current, titleRef.current]) {
      element?.style.removeProperty("transform");
      element?.style.removeProperty("transform-origin");
    }
  }, []);

  const changeStage = useCallback((next: IntroStage) => {
    stageRef.current = next;
    endedStageRef.current = null;
    setSceneEnded(false);
    setStage(next);
  }, []);

  const finishIntro = useCallback(() => {
    stopIntroMotion();
    setNameCentered(false);
    changeStage("done");
    onIntroEndRef.current();
  }, [changeStage, stopIntroMotion]);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    timersRef.current.push(window.setTimeout(callback, delayMs));
  }, []);

  const startOpeningIntro = useEffectEvent(() => {
    if (!introducing) {
      return;
    }

    const animated = canAnimateIntro([rootRef.current]);
    animatedRef.current = animated;
    if (!animated) {
      // 名前・一文・ゴールの盤面とその一言を、最初の止まった画面にそろえて見せる。
      changeStage("goal");
      return;
    }
    schedule(() => changeStage("goalAppearing"), BOARD_APPEAR_DELAY_MS);
    schedule(
      () => changeStage("goal"),
      BOARD_APPEAR_DELAY_MS + BOARD_APPEAR_MS,
    );
  });

  // 開くたびにこの画面を作り直すので、作ったときに導入を始める。
  useLayoutEffect(() => {
    startOpeningIntro();
    return stopIntroMotion;
  }, [stopIntroMotion]);

  // 名前を上部へ戻し、ルールと一言を出してから手を引き始める。動かさないときは、そのまま切り替える。
  const finishScenes = useCallback(() => {
    if (!animatedRef.current) {
      finishIntro();
      return;
    }
    if (!nameCenteredRef.current) {
      changeStage("reveal");
      schedule(finishIntro, REVEAL_MS);
      return;
    }
    // 大きな名前の位置は、開く動きが終わった今測る。
    const moves = [
      [pictogramRef.current, introPictogramRef.current],
      [titleRef.current, introTitleRef.current],
    ].flatMap(([element, source]) =>
      element && source
        ? [[element, getMoveFromIntroName(element, source)] as const]
        : [],
    );
    changeStage("header");
    for (const [element, transform] of moves) {
      element.style.transformOrigin = "0 0";
      animationsRef.current.push(
        element.animate([{ transform }, { transform: "none" }], {
          duration: NAME_MOVE_MS,
          easing: MOTION_EASING.standard,
          fill: "backwards",
        }),
      );
    }
    schedule(
      finishIntro,
      Math.max(NAME_MOVE_MS, REVEAL_AFTER_NAME_DELAY_MS + REVEAL_MS),
    );
  }, [changeStage, finishIntro, schedule]);

  // 盤面が場面の動きを終えたら、読む間だけ待って次の場面へ進む。
  const handleSceneEnd = useCallback(() => {
    const current = stageRef.current;
    if (
      (current !== "goal" && current !== "start") ||
      endedStageRef.current === current
    ) {
      return;
    }
    endedStageRef.current = current;
    setSceneEnded(true);
    const holdMs =
      sceneHoldMs[animatedRef.current ? "animated" : "still"][current];
    schedule(
      current === "goal" ? () => changeStage("start") : finishScenes,
      holdMs,
    );
  }, [changeStage, finishScenes, schedule]);

  // 「次へ」は待たずに次の場面へ進める。最後の場面では、名前を上部へ戻してから最初の手順を始める。
  function showNextScene(): void {
    const current = stageRef.current;
    stopIntroMotion();
    switch (current) {
      case "name":
      case "goalAppearing":
        changeStage("goal");
        return;
      case "goal":
        changeStage("start");
        return;
      case "start":
        finishScenes();
        return;
      case "header":
      case "reveal":
        finishIntro();
        return;
      case "done":
        return;
    }
  }

  function isOnNextButton(target: EventTarget): boolean {
    return target instanceof Node && !!nextButtonRef.current?.contains(target);
  }

  function skipIntro(event: ReactPointerEvent): void {
    if (introPlaying && !isOnNextButton(event.target)) {
      finishIntro();
    }
  }

  function handleKeyDownCapture(event: ReactKeyboardEvent): void {
    if (!introPlaying || event.key === "Escape" || event.key === "Tab") {
      return;
    }
    // 「次へ」を押すキーは、飛ばさずに「次へ」に任せる。
    if (
      isOnNextButton(event.target) &&
      (event.key === "Enter" || event.key === " ")
    ) {
      return;
    }
    // 導入を飛ばすキーで、閉じるボタンなどを押さないようにする。
    event.preventDefault();
    finishIntro();
  }

  // もう一度始めるときは、名前はもう上部にあるので、盤面を始めの盤面へ戻すところから見せる。
  function handleRestart(): void {
    stopIntroMotion();
    animatedRef.current = canAnimateIntro([rootRef.current]);
    onRestart();
    changeStage("start");
  }

  function handleFinish(): void {
    if (finish.entry === "selection") {
      finish.onStartPlay();
    } else {
      finish.onReturnToPlay();
    }
  }

  const stageView = introStageViews[stage];
  // 名前を大きく見せている間は上部の名前を伏せ、上部へ移す段で大きな名前の位置から動かして見せる。
  const headerNameHidden = nameCentered && stage !== "header";
  const caption =
    stageView.captionScene === "goal"
      ? intro.goalCaption
      : stageView.captionScene === "start"
        ? intro.startCaption
        : null;
  return (
    // 導入の間は、「次へ」のほかはどこを押しても、どのキーでも導入を飛ばす。
    <div
      ref={mergeRefs(rootRef, ref)}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
      onPointerDownCapture={skipIntro}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <DialogDescription className="sr-only">チュートリアル</DialogDescription>
      <div className="relative flex shrink-0 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 pt-2 pr-3 pl-4">
          <span
            ref={pictogramRef}
            className={cn("size-8 shrink-0", headerNameHidden && "opacity-0")}
          >
            <GamePictogram svg={pictogramSvg} />
          </span>
          <DialogTitle
            ref={titleRef}
            className={cn(
              "min-w-0 truncate text-screen-title",
              headerNameHidden && "opacity-0",
            )}
          >
            {title}
          </DialogTitle>
          {/* 名前の箱を文字の幅に保ち、導入で名前だけを動かせるようにするため、閉じるボタンを右端へ寄せる。 */}
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
        {/* 押せる部品に見えないよう、枠や塗りを付けず、文書の一部として読める印と文字で並べる。 */}
        <ul
          aria-label="ルール"
          className={cn(
            "flex min-h-6 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 text-supporting",
            stageView.rulesClassName,
          )}
        >
          {rules.map(function renderRule(rule) {
            return (
              <li key={rule.id} className="flex">
                {rule.earned ? (
                  // 手に入れた瞬間だけ現れる動きを付けるため、伏せたルールと別の要素にして作り直す。
                  <span
                    key="earned"
                    aria-current={rule.current ? "step" : undefined}
                    className={cn(
                      "flex animate-in items-center fade-in-0 zoom-in-75 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
                      rule.current
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {/* 今のルールだけ太くしても並びがずれないよう、太い字の幅を先に取っておく。 */}
                    <span
                      data-label={rule.label}
                      className={cn(
                        "inline-flex flex-col after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]",
                        rule.current && "font-semibold",
                      )}
                    >
                      {rule.label}
                    </span>
                  </span>
                ) : (
                  // 中身を伏せたルール。押せる部品に見えないよう、枠を付けずに文字の並びの一つとして置く。
                  <span key="hidden" className="text-muted-foreground/60">
                    ？
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* 一言が差し替わっても盤面が上下に動かないよう、見出し2行と補足1行がルールの行から離れて収まる高さに固定する。 */}
        <div
          aria-live="polite"
          className={cn(
            "flex h-24 shrink-0 flex-col items-center justify-end px-4",
            stageView.rulesClassName,
          )}
        >
          <p
            key={`${message.headline}\n${message.detail ?? ""}`}
            className="flex animate-in flex-col items-center gap-0.5 text-balance text-center duration-300 ease-(--ease-enter) fade-in-0 slide-in-from-bottom-1 whitespace-pre-line [word-break:auto-phrase] motion-reduce:animate-none"
          >
            <span className="text-heading">{message.headline}</span>
            <span className="min-h-5 text-muted-foreground text-supporting">
              {message.detail}
            </span>
          </p>
        </div>

        {/* 導入の間だけ、見出しの行より下（閉じるボタンと重ならない所）に、名前を大きく、その下に何をするパズルかの一文を並べる。 */}
        {nameCentered && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-14 bottom-0 flex flex-col items-center justify-center gap-3 px-6",
              stageView.introNameClassName,
            )}
          >
            {/* 上部の名前と同じ並びを1.5倍に見せる。大きさは見た目だけ変え、場所は拡大後の高さぶん空けておく。 */}
            <div
              aria-hidden="true"
              className={cn(
                "my-2 flex scale-150 items-center gap-2",
                stage === "header" && "invisible",
              )}
            >
              <span ref={introPictogramRef} className="size-8 shrink-0">
                <GamePictogram svg={pictogramSvg} />
              </span>
              <span ref={introTitleRef} className="text-screen-title">
                {title}
              </span>
            </div>
            <p className="text-balance text-center text-body whitespace-pre-line [word-break:auto-phrase]">
              {intro.purpose}
            </p>
          </div>
        )}
      </div>

      <main
        inert={introPlaying}
        className={cn(
          "flex min-h-0 flex-1 justify-center px-4 pt-4 pb-2 [container-type:size]",
          stageView.boardAreaClassName,
        )}
      >
        {renderBoard({
          scene: stageView.scene,
          playing: stageView.scenePlaying && !sceneEnded,
          onSceneEnd: handleSceneEnd,
        })}
      </main>

      {/*
        一言2行と「次へ」が収まる高さに固定し、導入の場面が替わっても、終えたときのボタンが出ても盤面を動かさない。
        導入の間は一言の場所を2行ぶん取っておき、一言が出ても替わっても「次へ」を動かさない。
      */}
      <footer className="flex h-28 shrink-0 flex-col items-center justify-center gap-2 px-4 pb-2">
        {introPlaying && (
          <div className="flex min-h-14 flex-col justify-end">
            {caption !== null && (
              <p
                key={caption}
                aria-live="polite"
                className={cn(
                  "text-balance text-center text-heading whitespace-pre-line [word-break:auto-phrase]",
                  stageView.captionClassName,
                )}
              >
                {caption}
              </p>
            )}
          </div>
        )}
        {introPlaying && (
          <span className={cn("flex", stageView.nextButtonClassName)}>
            <Button
              ref={nextButtonRef}
              type="button"
              size="lg"
              onClick={showNextScene}
            >
              次へ
            </Button>
          </span>
        )}
        {completed && (
          <div className="flex gap-2">
            <Button type="button" size="lg" onClick={handleFinish}>
              {finishLabels[finish.entry]}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleRestart}
            >
              もう一度
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
