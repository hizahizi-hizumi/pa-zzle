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
import type { TutorialIntroMessages, TutorialMessage } from "@/games/tutorial";
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

/** 終えたときの主な操作。どこへ進むかは開いた側が決める。 */
export type TutorialFinishAction = {
  label: string;
  onSelect: () => void;
};

/**
 * 導入のうち、盤面が受け持つ段。名前を見せた後に、何を目指すかと始めの盤面をゲームの盤面で見せる。
 * - `stage`: 盤面に見せさせるもの。
 *   - `goal`: 解き終えた盤面を見せる。
 *   - `start`: 始めの盤面を見せる。
 *   - `null`: 盤面の段の前と、導入を終えた後。盤面の動きを止める。
 * - `animated`: 動きを付けて見せるか。
 *   - `true`: `goal` では解き終えた盤面を現す動きを付け、見せ終えたら `onGoalShown` を呼ぶ。その後もしばらく `goal` のまま、目指す形だという一言を添えて見せておく。
 *     `start` では解き終えた盤面から始めの盤面へ移し、移し終えたら `onEnd` を呼ぶ。その後も導入を終えるまで `start` のまま保つ。
 *   - `false`: 動きを付けずに、その段の盤面をそのまま見せる。どちらも呼ばない。段を進めるのは画面の側が受け持つ。
 * - `onGoalShown`: 解き終えた盤面を見せ終えた。
 * - `onEnd`: 始めの盤面へ移し終えた。名前を上部へ移して導入を終える。
 */
export type TutorialBoardIntro = {
  stage: "goal" | "start" | null;
  animated: boolean;
  onGoalShown: () => void;
  onEnd: () => void;
};

type TutorialScreenProps = {
  /** パズルの名前。チュートリアルはパズルの入口の1つなので、何のパズルかを盤面と一緒に見せる。 */
  title: string;
  /** パズル選択と同じピクトグラム。名前と一緒に見せる。 */
  pictogramSvg: string;
  /** 導入で、手を引く前に何のパズルかを伝える言葉。 */
  intro: TutorialIntroMessages;
  rules: readonly TutorialRuleChip[];
  message: TutorialMessage;
  /** 導入を見せている間。開いたときと、もう一度始めたときに導入から始まる。 */
  introducing: boolean;
  completed: boolean;
  finishAction: TutorialFinishAction;
  /** ゲーム固有の盤面。盤面の大きさは盤面の側が、この領域の大きさから決める。 */
  renderBoard: (intro: TutorialBoardIntro) => ReactNode;
  /** 導入を終えたか、飛ばした。 */
  onIntroEnd: () => void;
  onRestart: () => void;
};

/**
 * 導入の段。
 * - `name`: 上部の領域の中央に、ピクトグラムと名前を大きく出し、その下に何をするパズルかの一文を添える。
 * - `boardAppearing`: 名前の下に盤面を出す。
 * - `goal`: 盤面に、解き終えた盤面を見せさせる。
 * - `goalHold`: 解き終えた盤面を、目指す形だという一言を添えて見せておく。
 * - `startLead`: もう一度始めるときに、解き終えた盤面を止めたまま、始めの盤面の一言を先に出す。
 * - `start`: 盤面に、始めの盤面へ移させる。
 * - `startHold`: 始めの盤面へ移し終えた後も、始めの盤面の一言を読める間だけ見せておく。
 * - `header`: 名前を上部へ移し、移し終える頃にルールと一言を出す。
 * - `reveal`: 名前がもう上部にあるときに、ルールと一言を出す。
 * - `done`: 導入を終えた。
 */
type IntroStage =
  | "name"
  | "boardAppearing"
  | "goal"
  | "goalHold"
  | "startLead"
  | "start"
  | "startHold"
  | "header"
  | "reveal"
  | "done";

const NAME_APPEAR_MS = 300;
/** 何をするパズルかの一文は、名前に少し遅れて出す。 */
const TAGLINE_APPEAR_DELAY_MS = 200;
const TAGLINE_APPEAR_MS = 300;
const TAGLINE_LEAVE_MS = 200;
/** 名前が現れてから盤面を出すまで。盤面に目が移る前に、名前と一文を読み始められる間を取る。 */
const BOARD_APPEAR_DELAY_MS = 800;
const BOARD_APPEAR_MS = 250;
/** 解き終えた盤面を見せ終えてから、始めの盤面へ移すまで。目指す形だという一言を読める間を取る。 */
const GOAL_HOLD_MS = 1000;
/** もう一度始めるときに、始めの盤面の一言を出してから盤面を戻し始めるまで。一言に目を向けてから戻す動きを見せる。 */
const RESTART_CAPTION_LEAD_MS = 500;
/** 始めの盤面へ移し終えてから、名前を上部へ移すまで。動きが止まった後に、始めの盤面の一言を読める間を取る。 */
const START_HOLD_MS = 900;
/** 名前を上部へ移す間。名前はピクトグラムを追って少し遅れて動き、通り道で重ならないようにする。 */
const PICTOGRAM_MOVE_MS = 400;
const TITLE_MOVE_DELAY_MS = 80;
/** ルールと一言は、名前がその行を通り過ぎてから出す。`header` の見せ方の `delay-350` と同じ値。 */
const REVEAL_AFTER_NAME_DELAY_MS = 350;
const REVEAL_MS = 300;

/** 動きを減らす設定などで、名前と一文、解き終えた盤面、始めの盤面を止めて見せるそれぞれの間。一言を読める長さを取る。 */
const STILL_STAGE_MS = 1500;

/** 上部での大きさに対する、導入の間の大きさ。一文を添えても上部の領域に収まる大きさにする。 */
const INTRO_PICTOGRAM_SCALE = 2;
const INTRO_TITLE_SCALE = 1.5;
/** 導入の間の、ピクトグラムと名前の間と、名前と一文の間（px）。 */
const INTRO_NAME_GAP_PX = 6;

/**
 * 段ごとの見せ方。
 * - `rulesClassName`: ルールと一言。導入を終えた後は動かさない。
 * - `boardAreaClassName`: 盤面の領域。
 * - `boardStage`: 盤面に見せさせるもの。
 * - `boardStill`: 導入に動きを付けるときも、盤面には動きを付けずに見せさせる。
 * - `caption`: 盤面の下に添える導入の一言。`leaving` は、ルールと一言を出すのに合わせて消していく。
 */
type IntroStageView = {
  rulesClassName: string;
  boardAreaClassName: string;
  boardStage: TutorialBoardIntro["stage"];
  boardStill?: true;
  caption: { kind: "goal" | "start"; leaving: boolean } | null;
};

const hiddenRulesClassName = "opacity-0";

const introStageViews = {
  name: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "opacity-0",
    boardStage: null,
    caption: null,
  },
  boardAppearing: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "animate-in fade-in-0 duration-250 ease-(--ease-enter)",
    boardStage: null,
    caption: null,
  },
  goal: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "",
    boardStage: "goal",
    caption: null,
  },
  goalHold: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "",
    boardStage: "goal",
    caption: { kind: "goal", leaving: false },
  },
  startLead: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "",
    boardStage: "goal",
    boardStill: true,
    caption: { kind: "start", leaving: false },
  },
  start: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "",
    boardStage: "start",
    caption: { kind: "start", leaving: false },
  },
  startHold: {
    rulesClassName: hiddenRulesClassName,
    boardAreaClassName: "",
    boardStage: "start",
    caption: { kind: "start", leaving: false },
  },
  header: {
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 delay-350 fill-mode-backwards ease-(--ease-enter)",
    boardAreaClassName: "",
    boardStage: "start",
    caption: { kind: "start", leaving: true },
  },
  reveal: {
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter)",
    boardAreaClassName: "",
    boardStage: "start",
    caption: { kind: "start", leaving: true },
  },
  done: {
    rulesClassName: "",
    boardAreaClassName: "",
    boardStage: null,
    caption: null,
  },
} as const satisfies Record<IntroStage, IntroStageView>;

/** 動きを減らす設定か、動きを描けない環境では、導入の各段を動かさずに止めて見せる。 */
function canAnimateIntro(): boolean {
  return (
    !prefersReducedMotion() &&
    typeof document.documentElement.animate === "function"
  );
}

/**
 * 上部のピクトグラムと名前を、上部の領域の中央に縦に重ねて大きく見せる変形と、その下に添える一文の位置。
 * 上部に置いた要素そのものを変形し、導入の終わりに変形を外して上部へ戻す（FLIP）。
 * 一文は導入の間だけ見せるので、上部の領域の中の位置（px）だけを返す。
 */
function getIntroNameLayout(
  region: HTMLElement,
  pictogram: HTMLElement,
  title: HTMLElement,
  tagline: HTMLElement,
): { pictogram: string; title: string; taglineTop: number } {
  const regionRect = region.getBoundingClientRect();
  const pictogramRect = pictogram.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const taglineHeight = tagline.getBoundingClientRect().height;
  const pictogramSize = pictogramRect.width * INTRO_PICTOGRAM_SCALE;
  const titleWidth = titleRect.width * INTRO_TITLE_SCALE;
  const titleHeight = titleRect.height * INTRO_TITLE_SCALE;
  const stackHeight =
    pictogramSize +
    INTRO_NAME_GAP_PX +
    titleHeight +
    INTRO_NAME_GAP_PX +
    taglineHeight;
  const stackTop = regionRect.top + (regionRect.height - stackHeight) / 2;
  const centerX = regionRect.left + regionRect.width / 2;

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
      stackTop + pictogramSize + INTRO_NAME_GAP_PX,
      INTRO_TITLE_SCALE,
    ),
    taglineTop:
      stackTop -
      regionRect.top +
      pictogramSize +
      INTRO_NAME_GAP_PX +
      titleHeight +
      INTRO_NAME_GAP_PX,
  };
}

/**
 * 開いたときに、パズルの名前と何をするパズルか、目指す盤面、始めの盤面を順に見せてから、1つの盤面を解きながらルールを1つずつ身につけていく画面。
 * 盤面を主役にし、上部にパズルの名前と手に入れたルール、盤面の直上に短い一言だけを出す。
 * 導入はどこを押しても、どのキーでも飛ばせる。動きを減らす設定などでは、各段を動かさずに一言を読める間だけ止めて見せる。
 */
export function TutorialScreen({
  title,
  pictogramSvg,
  intro,
  rules,
  message,
  introducing,
  completed,
  finishAction,
  renderBoard,
  onIntroEnd,
  onRestart,
}: TutorialScreenProps) {
  const [stage, setStage] = useState<IntroStage>(introducing ? "name" : "done");
  // 導入に動きを付けるか。開いたときと、もう一度始めたときに決める。
  const [animated, setAnimated] = useState(canAnimateIntro);
  const regionRef = useRef<HTMLDivElement>(null);
  const pictogramRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  // 名前を上部の外で見せている間の変形。上部へ戻すときの始まりになる。
  const nameTransformsRef = useRef<{ pictogram: string; title: string } | null>(
    null,
  );
  const timersRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const onIntroEndRef = useRef(onIntroEnd);
  const introPlaying = stage !== "done";

  useLayoutEffect(() => {
    onIntroEndRef.current = onIntroEnd;
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
    nameTransformsRef.current = null;
    for (const element of [pictogramRef.current, titleRef.current]) {
      element?.style.removeProperty("transform");
      element?.style.removeProperty("transform-origin");
    }
    taglineRef.current?.style.removeProperty("top");
    taglineRef.current?.style.removeProperty("opacity");
  }, []);

  const finishIntro = useCallback(() => {
    stopIntroMotion();
    setStage("done");
    onIntroEndRef.current();
  }, [stopIntroMotion]);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    timersRef.current.push(window.setTimeout(callback, delayMs));
  }, []);

  const startOpeningIntro = useEffectEvent(() => {
    const region = regionRef.current;
    const pictogram = pictogramRef.current;
    const titleElement = titleRef.current;
    const tagline = taglineRef.current;
    if (!introducing) {
      return;
    }
    if (!region || !pictogram || !titleElement || !tagline) {
      finishIntro();
      return;
    }

    const { taglineTop, ...transforms } = getIntroNameLayout(
      region,
      pictogram,
      titleElement,
      tagline,
    );
    nameTransformsRef.current = transforms;
    tagline.style.top = `${taglineTop}px`;
    if (!animated) {
      // 名前と一文、解き終えた盤面、始めの盤面を、それぞれ一言を読める間だけ止めて見せる。
      tagline.style.opacity = "1";
      for (const [element, transform] of [
        [pictogram, transforms.pictogram],
        [titleElement, transforms.title],
      ] as const) {
        element.style.transformOrigin = "0 0";
        element.style.transform = transform;
      }
      schedule(() => setStage("goalHold"), STILL_STAGE_MS);
      schedule(() => setStage("startHold"), STILL_STAGE_MS * 2);
      schedule(finishIntro, STILL_STAGE_MS * 3);
      return;
    }
    animationsRef.current.push(
      tagline.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: TAGLINE_APPEAR_MS,
        delay: TAGLINE_APPEAR_DELAY_MS,
        easing: MOTION_EASING.enter,
        fill: "both",
      }),
    );
    for (const [element, transform] of [
      [pictogram, transforms.pictogram],
      [titleElement, transforms.title],
    ] as const) {
      element.style.transformOrigin = "0 0";
      element.style.transform = transform;
      animationsRef.current.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: NAME_APPEAR_MS,
          easing: MOTION_EASING.enter,
          fill: "backwards",
        }),
      );
    }
    schedule(() => setStage("boardAppearing"), BOARD_APPEAR_DELAY_MS);
    schedule(() => setStage("goal"), BOARD_APPEAR_DELAY_MS + BOARD_APPEAR_MS);
  });

  // 開くたびにこの画面を作り直すので、作ったときに導入を始める。名前の位置は描く前に決める。
  useLayoutEffect(() => {
    startOpeningIntro();
    return stopIntroMotion;
  }, [stopIntroMotion]);

  // 解き終えた盤面を見せ終えたら、目指す形だという一言を読める間だけ見せておいてから、始めの盤面へ移させる。
  const handleGoalShown = useCallback(() => {
    setStage("goalHold");
    schedule(() => setStage("start"), GOAL_HOLD_MS);
  }, [schedule]);

  // 名前を上部へ戻し、ルールと一言を出してから手を引き始める。
  const moveNameToHeader = useCallback(() => {
    const transforms = nameTransformsRef.current;
    if (!transforms) {
      setStage("reveal");
      schedule(finishIntro, REVEAL_MS);
      return;
    }
    setStage("header");
    for (const [element, transform, delay] of [
      [pictogramRef.current, transforms.pictogram, 0],
      [titleRef.current, transforms.title, TITLE_MOVE_DELAY_MS],
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
    const tagline = taglineRef.current;
    if (tagline) {
      animationsRef.current.push(
        tagline.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: TAGLINE_LEAVE_MS,
          easing: MOTION_EASING.exit,
          fill: "forwards",
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
  }, [finishIntro, schedule]);

  // 始めの盤面へ移し終えたら、始めの盤面の一言を読める間だけ見せておいてから、名前を上部へ戻す。
  const handleStartShown = useCallback(() => {
    setStage("startHold");
    schedule(moveNameToHeader, START_HOLD_MS);
  }, [moveNameToHeader, schedule]);

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

  // もう一度始めるときは、名前と解き終えた盤面はもう見えているので、始めの盤面の一言を先に出し、盤面を始めの盤面へ戻すところから見せる。
  // 動きを付けないときは、始めの盤面を一言と一緒に止めて見せてから始める。
  function handleRestart(): void {
    stopIntroMotion();
    onRestart();
    const nextAnimated = canAnimateIntro();
    setAnimated(nextAnimated);
    if (nextAnimated) {
      setStage("startLead");
      schedule(() => setStage("start"), RESTART_CAPTION_LEAD_MS);
    } else {
      setStage("startHold");
      schedule(finishIntro, STILL_STAGE_MS);
    }
  }

  const stageView: IntroStageView = introStageViews[stage];
  const caption = stageView.caption;
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

        {/* 名前の下に添える、何をするパズルかの一文。導入の間だけ、位置と現れ方を導入の動きで決める。 */}
        {introPlaying && (
          <p
            ref={taglineRef}
            className="pointer-events-none absolute inset-x-0 top-0 px-4 text-balance text-center text-body opacity-0 [word-break:auto-phrase]"
          >
            {intro.tagline}
          </p>
        )}

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
      </div>

      <main
        inert={introPlaying}
        className={cn(
          "flex min-h-0 flex-1 justify-center px-4 pt-6 pb-2 [container-type:size]",
          stageView.boardAreaClassName,
        )}
      >
        {renderBoard({
          stage: stageView.boardStage,
          animated: animated && !stageView.boardStill,
          onGoalShown: handleGoalShown,
          onEnd: handleStartShown,
        })}
      </main>

      <footer className="flex h-28 shrink-0 items-center justify-center gap-2 px-4 pb-2">
        {caption && (
          // 一言が替わるたびに作り直して、現れる動きを付け直す。盤面についての一言なので、盤面のすぐ下に寄せる。
          <p
            key={caption.kind}
            className={cn(
              "mt-3 self-start text-balance text-center text-heading [word-break:auto-phrase]",
              caption.leaving
                ? "animate-out fade-out-0 fill-mode-forwards duration-200 ease-(--ease-exit)"
                : "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter) motion-reduce:animate-none",
            )}
          >
            {intro[caption.kind]}
          </p>
        )}
        {completed && (
          <>
            <Button type="button" size="lg" onClick={finishAction.onSelect}>
              {finishAction.label}
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
