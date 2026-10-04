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
import type { TutorialMessage } from "@/games/tutorial";
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
 * - `playing`: 盤面の段に入ってから導入を終えるまで `true`。`false` に戻ったら盤面の動きを止め、始めの盤面を見せる。
 * - `onEnd`: 盤面の段の動きを終えたら呼ぶ。名前を上部へ移して導入を終える。
 */
export type TutorialBoardIntro = {
  playing: boolean;
  onEnd: () => void;
};

type TutorialScreenProps = {
  /** パズルの名前。チュートリアルはパズルの入口の1つなので、何のパズルかを盤面と一緒に見せる。 */
  title: string;
  /** パズル選択と同じピクトグラム。名前と一緒に見せる。 */
  pictogramSvg: string;
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
 * - `name`: 上部の領域の中央に、ピクトグラムと名前を大きく出す。
 * - `boardAppearing`: 名前の下に盤面を出す。
 * - `board`: 盤面の段をゲームに任せる。
 * - `header`: 名前を上部へ移し、移し終える頃にルールと一言を出す。
 * - `reveal`: 名前がもう上部にあるときに、ルールと一言を出す。
 * - `done`: 導入を終えた。
 */
type IntroStage =
  | "name"
  | "boardAppearing"
  | "board"
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

/** 上部での大きさに対する、導入の間の大きさ。 */
const INTRO_PICTOGRAM_SCALE = 2.5;
const INTRO_TITLE_SCALE = 1.5;
/** 導入の間の、ピクトグラムと名前の間（px）。 */
const INTRO_NAME_GAP_PX = 8;

/**
 * 段ごとの見せ方。
 * - `rulesClassName`: ルールと一言。導入を終えた後は動かさない。
 * - `boardAreaClassName`: 盤面の領域。
 * - `boardPlaying`: 盤面の段に入ってから導入を終えるまで。
 */
const introStageViews = {
  name: {
    rulesClassName: "opacity-0",
    boardAreaClassName: "opacity-0",
    boardPlaying: false,
  },
  boardAppearing: {
    rulesClassName: "opacity-0",
    boardAreaClassName: "animate-in fade-in-0 duration-250 ease-(--ease-enter)",
    boardPlaying: false,
  },
  board: {
    rulesClassName: "opacity-0",
    boardAreaClassName: "",
    boardPlaying: true,
  },
  header: {
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 delay-350 fill-mode-backwards ease-(--ease-enter)",
    boardAreaClassName: "",
    boardPlaying: true,
  },
  reveal: {
    rulesClassName:
      "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-(--ease-enter)",
    boardAreaClassName: "",
    boardPlaying: true,
  },
  done: { rulesClassName: "", boardAreaClassName: "", boardPlaying: false },
} as const satisfies Record<
  IntroStage,
  { rulesClassName: string; boardAreaClassName: string; boardPlaying: boolean }
>;

/** 動きを減らす設定か、動きを描けない環境では、導入を見せずに始める。 */
function canPlayIntro(elements: readonly (HTMLElement | null)[]): boolean {
  return (
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
    elements.every((element) => typeof element?.animate === "function")
  );
}

/** デザイントークンのイージング。読めなければ近い既定値を使う。 */
function readEasing(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/**
 * 上部のピクトグラムと名前を、上部の領域の中央に縦に重ねて大きく見せる変形。
 * 上部に置いた要素そのものを変形し、導入の終わりに変形を外して上部へ戻す（FLIP）。
 */
function getIntroNameTransforms(
  region: HTMLElement,
  pictogram: HTMLElement,
  title: HTMLElement,
): { pictogram: string; title: string } {
  const regionRect = region.getBoundingClientRect();
  const pictogramRect = pictogram.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const pictogramSize = pictogramRect.width * INTRO_PICTOGRAM_SCALE;
  const titleWidth = titleRect.width * INTRO_TITLE_SCALE;
  const titleHeight = titleRect.height * INTRO_TITLE_SCALE;
  const stackTop =
    regionRect.top +
    (regionRect.height - pictogramSize - INTRO_NAME_GAP_PX - titleHeight) / 2;
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
  };
}

/**
 * 開いたときに、パズルの名前、目指す盤面、始めの盤面を順に見せてから、1つの盤面を埋めながらルールを1つずつ身につけていく画面。
 * 盤面を主役にし、上部にパズルの名前と手に入れたルール、盤面の直上に短い一言だけを出す。
 * 導入はどこを押しても、どのキーでも飛ばせる。
 */
export function TutorialScreen({
  title,
  pictogramSvg,
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
  const regionRef = useRef<HTMLDivElement>(null);
  const pictogramRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
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
    if (!introducing) {
      return;
    }
    if (
      !region ||
      !pictogram ||
      !titleElement ||
      !canPlayIntro([pictogram, titleElement])
    ) {
      finishIntro();
      return;
    }

    const transforms = getIntroNameTransforms(region, pictogram, titleElement);
    nameTransformsRef.current = transforms;
    const enterEasing = readEasing("--ease-enter", "ease-out");
    for (const [element, transform] of [
      [pictogram, transforms.pictogram],
      [titleElement, transforms.title],
    ] as const) {
      element.style.transformOrigin = "0 0";
      element.style.transform = transform;
      animationsRef.current.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: NAME_APPEAR_MS,
          easing: enterEasing,
          fill: "backwards",
        }),
      );
    }
    schedule(() => setStage("boardAppearing"), BOARD_APPEAR_DELAY_MS);
    schedule(() => setStage("board"), BOARD_APPEAR_DELAY_MS + BOARD_APPEAR_MS);
  });

  // 開くたびにこの画面を作り直すので、作ったときに導入を始める。名前の位置は描く前に決める。
  useLayoutEffect(() => {
    startOpeningIntro();
    return stopIntroMotion;
  }, [stopIntroMotion]);

  // 盤面の段を終えたら、名前を上部へ戻し、ルールと一言を出してから手を引き始める。
  const handleBoardIntroEnd = useCallback(() => {
    const transforms = nameTransformsRef.current;
    if (!transforms) {
      setStage("reveal");
      schedule(finishIntro, REVEAL_MS);
      return;
    }
    setStage("header");
    const standardEasing = readEasing("--ease-standard", "ease-in-out");
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
          easing: standardEasing,
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
  }, [finishIntro, schedule]);

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
    onRestart();
    if (canPlayIntro([regionRef.current])) {
      setStage("board");
    } else {
      setStage("done");
      onIntroEndRef.current();
    }
  }

  const stageView = introStageViews[stage];
  return (
    // 導入の間は、どこを押しても、どのキーでも導入を飛ばす。
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerDownCapture={skipIntro}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <DialogDescription className="sr-only">チュートリアル</DialogDescription>
      <div ref={regionRef} className="flex shrink-0 flex-col">
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
      </div>

      <main
        inert={introPlaying}
        className={cn(
          "flex min-h-0 flex-1 justify-center px-4 pt-6 pb-2 [container-type:size]",
          stageView.boardAreaClassName,
        )}
      >
        {renderBoard({
          playing: stageView.boardPlaying,
          onEnd: handleBoardIntroEnd,
        })}
      </main>

      <footer className="flex h-28 shrink-0 items-center justify-center gap-2 px-4 pb-2">
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
