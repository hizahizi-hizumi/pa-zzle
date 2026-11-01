import { X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { Badge } from "@/components/ui/badge";
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
 * - `current`: 今の手順で示しているルール。一言で示したルールがどれかを、チップの側でも分かるようにする。
 */
export type TutorialRuleChip = {
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
  rules: readonly TutorialRuleChip[];
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
};

/**
 * 導入の段。開いたときは `name` から、もう一度始めたときは `start` から進む。
 * - `name`: 上部の領域の中央に、ピクトグラムと名前と、何をするパズルかの一文を大きく出す。
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

const NAME_APPEAR_MS = 300;
/** 名前が現れてから盤面を出すまで。 */
const BOARD_APPEAR_DELAY_MS = 300;
const BOARD_APPEAR_MS = 250;
/** 名前を上部へ移す間。名前はピクトグラムを追って少し遅れて動き、通り道で重ならないようにする。 */
const PICTOGRAM_MOVE_MS = 400;
const TITLE_MOVE_DELAY_MS = 80;
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

/** 上部での大きさに対する、導入の間の大きさ。 */
const INTRO_PICTOGRAM_SCALE = 2;
const INTRO_TITLE_SCALE = 1.5;
/** 導入の間の、ピクトグラム・名前・一文の間（px）。 */
const INTRO_NAME_GAP_PX = 8;

/**
 * 段ごとの見せ方。
 * - `purposeClassName`: 何をするパズルかの一文。名前を大きく見せている間だけ出し、名前を上部へ移すときに消す。
 * - `rulesClassName`: ルールと一言。導入を終えた後は動かさない。
 * - `boardAreaClassName`: 盤面の領域。
 * - `scene`: 盤面が見せる場面。
 * - `scenePlaying`: 盤面に場面の動きを任せている間。
 * - `captionScene`: 盤面の下に、どの場面の一言を添えるか。
 * - `captionClassName`: 盤面の下の一言。
 */
const introStageViews = {
  name: {
    purposeClassName:
      "animate-in fade-in-0 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
    rulesClassName: "opacity-0",
    boardAreaClassName: "opacity-0",
    scene: "goal",
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
  },
  goalAppearing: {
    purposeClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName:
      "animate-in fade-in-0 duration-250 ease-(--ease-enter) motion-reduce:animate-none",
    scene: "goal",
    scenePlaying: false,
    captionScene: "goal",
    captionClassName:
      "animate-in fade-in-0 duration-250 ease-(--ease-enter) motion-reduce:animate-none",
  },
  goal: {
    purposeClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName: "",
    scene: "goal",
    scenePlaying: true,
    captionScene: "goal",
    captionClassName: "",
  },
  start: {
    purposeClassName: "",
    rulesClassName: "opacity-0",
    boardAreaClassName: "",
    scene: "start",
    scenePlaying: true,
    captionScene: "start",
    captionClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
  },
  header: {
    purposeClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 delay-350 fill-mode-backwards ease-(--ease-enter)",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: "start",
    captionClassName:
      "animate-out fade-out-0 duration-200 fill-mode-forwards ease-(--ease-exit)",
  },
  reveal: {
    purposeClassName: "",
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter)",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
  },
  done: {
    purposeClassName: "",
    rulesClassName: "",
    boardAreaClassName: "",
    scene: null,
    scenePlaying: false,
    captionScene: null,
    captionClassName: "",
  },
} as const satisfies Record<
  IntroStage,
  {
    purposeClassName: string;
    rulesClassName: string;
    boardAreaClassName: string;
    scene: TutorialIntroScene | null;
    scenePlaying: boolean;
    captionScene: TutorialIntroScene | null;
    captionClassName: string;
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

/** 導入の間の名前の配置。`purposeTop` は、何をするパズルかの一文の、上部の領域に対する上端（px）。 */
type IntroNameLayout = {
  pictogram: string;
  title: string;
  purposeTop: number;
};

/**
 * 上部のピクトグラムと名前を、何をするパズルかの一文と一緒に、上部の領域の中央へ縦に重ねて大きく見せる配置。
 * 上部に置いた要素そのものを変形し、導入の終わりに変形を外して上部へ戻す（FLIP）。
 */
function getIntroNameLayout(
  region: HTMLElement,
  pictogram: HTMLElement,
  title: HTMLElement,
  purpose: HTMLElement,
): IntroNameLayout {
  const regionRect = region.getBoundingClientRect();
  const pictogramRect = pictogram.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const purposeHeight = purpose.getBoundingClientRect().height;
  const pictogramSize = pictogramRect.width * INTRO_PICTOGRAM_SCALE;
  const titleWidth = titleRect.width * INTRO_TITLE_SCALE;
  const titleHeight = titleRect.height * INTRO_TITLE_SCALE;
  const stackHeight =
    pictogramSize +
    INTRO_NAME_GAP_PX +
    titleHeight +
    INTRO_NAME_GAP_PX +
    purposeHeight;
  const stackTop = regionRect.top + (regionRect.height - stackHeight) / 2;
  const centerX = regionRect.left + regionRect.width / 2;
  const titleTop = stackTop + pictogramSize + INTRO_NAME_GAP_PX;

  function toTransform(
    rect: DOMRect,
    left: number,
    top: number,
    scale: number,
  ) {
    return `translate(${left - rect.left}px, ${top - rect.top}px) scale(${scale})`;
  }

  return {
    pictogram: toTransform(
      pictogramRect,
      centerX - pictogramSize / 2,
      stackTop,
      INTRO_PICTOGRAM_SCALE,
    ),
    title: toTransform(
      titleRect,
      centerX - titleWidth / 2,
      titleTop,
      INTRO_TITLE_SCALE,
    ),
    purposeTop: titleTop + titleHeight + INTRO_NAME_GAP_PX - regionRect.top,
  };
}

/**
 * 開いたときに、パズルの名前と何をするパズルか、ゴールの盤面、始めの盤面を順に見せてから、1つの盤面を埋めながらルールを1つずつ身につけていく画面。
 * 盤面を主役にし、上部にパズルの名前と手に入れたルール、盤面の直上に短い一言だけを出す。
 * 導入はどこを押しても、どのキーでも飛ばせる。
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
}: TutorialScreenProps) {
  const [stage, setStage] = useState<IntroStage>(introducing ? "name" : "done");
  const [purposeTop, setPurposeTop] = useState(0);
  // 名前を上部の外で大きく見せている間。何をするパズルかの一文は、この間だけ名前の下に出す。
  const [nameCentered, setNameCentered] = useState(introducing);
  const regionRef = useRef<HTMLDivElement>(null);
  const pictogramRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const purposeRef = useRef<HTMLParagraphElement>(null);
  // 名前を上部の外で見せている間の変形。上部へ戻すときの始まりになる。
  const nameLayoutRef = useRef<IntroNameLayout | null>(null);
  const animatedRef = useRef(false);
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
    nameLayoutRef.current = null;
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
    const region = regionRef.current;
    const pictogram = pictogramRef.current;
    const titleElement = titleRef.current;
    const purpose = purposeRef.current;
    if (!introducing) {
      return;
    }
    if (!region || !pictogram || !titleElement || !purpose) {
      finishIntro();
      return;
    }

    const animated = canAnimateIntro([pictogram, titleElement]);
    animatedRef.current = animated;
    const layout = getIntroNameLayout(region, pictogram, titleElement, purpose);
    nameLayoutRef.current = layout;
    setPurposeTop(layout.purposeTop);
    for (const [element, transform] of [
      [pictogram, layout.pictogram],
      [titleElement, layout.title],
    ] as const) {
      element.style.transformOrigin = "0 0";
      element.style.transform = transform;
      if (animated) {
        animationsRef.current.push(
          element.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: NAME_APPEAR_MS,
            easing: MOTION_EASING.enter,
            fill: "backwards",
          }),
        );
      }
    }
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

  // 開くたびにこの画面を作り直すので、作ったときに導入を始める。名前の位置は描く前に決める。
  useLayoutEffect(() => {
    startOpeningIntro();
    return stopIntroMotion;
  }, [stopIntroMotion]);

  // 名前を上部へ戻し、ルールと一言を出してから手を引き始める。動かさないときは、そのまま切り替える。
  const finishScenes = useCallback(() => {
    const layout = nameLayoutRef.current;
    if (!animatedRef.current) {
      finishIntro();
      return;
    }
    if (!layout) {
      changeStage("reveal");
      schedule(finishIntro, REVEAL_MS);
      return;
    }
    changeStage("header");
    for (const [element, transform, delay] of [
      [pictogramRef.current, layout.pictogram, 0],
      [titleRef.current, layout.title, TITLE_MOVE_DELAY_MS],
    ] as const) {
      if (!element) {
        continue;
      }
      element.style.removeProperty("transform");
      animationsRef.current.push(
        element.animate([{ transform }, { transform: "none" }], {
          duration: PICTOGRAM_MOVE_MS,
          delay,
          easing: MOTION_EASING.standard,
          fill: "backwards",
        }),
      );
    }
    schedule(
      finishIntro,
      Math.max(
        TITLE_MOVE_DELAY_MS + PICTOGRAM_MOVE_MS,
        REVEAL_AFTER_NAME_DELAY_MS + REVEAL_MS,
      ),
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

  function skipIntro(): void {
    if (introPlaying) {
      finishIntro();
    }
  }

  function handleKeyDownCapture(event: ReactKeyboardEvent): void {
    if (!introPlaying || event.key === "Escape" || event.key === "Tab") {
      return;
    }
    // 導入を飛ばすキーで、閉じるボタンなどを押さないようにする。
    event.preventDefault();
    finishIntro();
  }

  // もう一度始めるときは、名前はもう上部にあるので、盤面を始めの盤面へ戻すところから見せる。
  function handleRestart(): void {
    stopIntroMotion();
    animatedRef.current = canAnimateIntro([regionRef.current]);
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
  const caption =
    stageView.captionScene === "goal"
      ? intro.goalCaption
      : stageView.captionScene === "start"
        ? intro.startCaption
        : null;
  return (
    // 導入の間は、どこを押しても、どのキーでも導入を飛ばす。
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerDownCapture={skipIntro}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <DialogDescription className="sr-only">チュートリアル</DialogDescription>
      <div ref={regionRef} className="relative flex shrink-0 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 pt-2 pr-3 pl-4">
          <span ref={pictogramRef} className="size-8 shrink-0">
            <GamePictogram svg={pictogramSvg} />
          </span>
          <DialogTitle
            ref={titleRef}
            className="min-w-0 truncate text-screen-title"
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
        <ul
          aria-label="ルール"
          className={cn(
            "flex min-h-6 shrink-0 flex-wrap gap-1.5 px-4",
            stageView.rulesClassName,
          )}
        >
          {rules.map(function renderRuleChip(rule) {
            return (
              <li key={rule.id} className="flex">
                {rule.earned ? (
                  // 手に入れた瞬間だけ現れる動きを付けるため、伏せたチップと別の要素にして作り直す。
                  <span
                    key="earned"
                    className="flex animate-in fade-in-0 zoom-in-75 duration-300 ease-(--ease-enter) motion-reduce:animate-none"
                  >
                    <Badge
                      variant="secondary"
                      aria-current={rule.current ? "step" : undefined}
                      className={cn(
                        "transition-shadow duration-300",
                        rule.current && "ring-2 ring-ring",
                      )}
                    >
                      {rule.label}
                    </Badge>
                  </span>
                ) : (
                  <Badge key="hidden" variant="outline">
                    ？
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>

        {/* 一言が差し替わっても盤面が上下に動かないよう、見出し2行と補足1行が収まる高さに固定する。 */}
        <div
          aria-live="polite"
          className={cn(
            "flex h-20 shrink-0 flex-col items-center justify-end px-4",
            stageView.rulesClassName,
          )}
        >
          <p
            key={`${message.headline}\n${message.detail ?? ""}`}
            className="flex animate-in flex-col items-center gap-0.5 text-balance text-center duration-300 ease-(--ease-enter) fade-in-0 slide-in-from-bottom-1 [word-break:auto-phrase] motion-reduce:animate-none"
          >
            <span className="text-heading">{message.headline}</span>
            <span className="min-h-5 text-muted-foreground text-supporting">
              {message.detail}
            </span>
          </p>
        </div>

        {/* 導入の間だけ、大きく見せた名前の下に置く。位置は名前の配置と一緒に決める。 */}
        <p
          ref={purposeRef}
          style={{ top: purposeTop }}
          className={cn(
            "pointer-events-none absolute inset-x-6 text-balance text-center text-body [word-break:auto-phrase]",
            nameCentered ? stageView.purposeClassName : "hidden",
          )}
        >
          {intro.purpose}
        </p>
      </div>

      <main
        inert={introPlaying}
        className={cn(
          "flex min-h-0 flex-1 justify-center px-4 pt-6 pb-2 [container-type:size]",
          stageView.boardAreaClassName,
        )}
      >
        {renderBoard({
          scene: stageView.scene,
          playing: stageView.scenePlaying && !sceneEnded,
          onSceneEnd: handleSceneEnd,
        })}
      </main>

      <footer className="flex h-28 shrink-0 items-center justify-center gap-2 px-4 pb-2">
        {caption !== null && (
          <p
            key={caption}
            aria-live="polite"
            className={cn(
              "text-balance text-center text-heading [word-break:auto-phrase]",
              stageView.captionClassName,
            )}
          >
            {caption}
          </p>
        )}
        {completed && (
          <>
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
          </>
        )}
      </footer>
    </div>
  );
}
